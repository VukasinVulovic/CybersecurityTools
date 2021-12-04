import sqlite3
import os

AppData = os.environ["USERPROFILE"] + "\\AppData"

def getPath():
    path = AppData + "\\Roaming\\ViberPC\\"

    for p in os.listdir(path):
        p = path + p + "\\"
        
        if os.path.exists(p + "viber.db"):
            return p
        
def getContacts(path):
    contacts = []

    con = sqlite3.connect(path + "viber.db")
    cur = con.cursor()
    cur.execute("SELECT ContactID, Name, ViberContact, Number, ClientName FROM Contact")

    db_contacts = cur.fetchall()

    for contact in db_contacts:
        contacts.append({
            "id": contact[0],
            "name": "" if contact[1] is None else contact[1].encode("ascii", "ignore").decode(), #remove unicode
            "viber": contact[2],
            "number": contact[3],
            "client_name": "" if contact[4] is None else contact[4].encode("ascii", "ignore").decode() #remove unicode
        })
    
    return contacts

def getMessages(path):
    messages = []

    con = sqlite3.connect(path + "viber.db")
    cur = con.cursor()
    cur.execute("SELECT ChatID, MessageStatus, Subject, Body, PayloadPath, MessageInfo FROM EventInfo")
    messages_db = cur.fetchall()

    chats = {}
    cur.execute("SELECT * FROM ChatRelation")
    chat_db = cur.fetchall()

    for c in chat_db:
        try:
            chats[str(c[0])] #if not exists
        except:
            chats[str(c[0])] = []

        cur.execute("SELECT Name, Number FROM Contact WHERE ContactID = '" + str(c[1]) + "'")
        contact = cur.fetchone()

        chats[str(c[0])].append({
            "contact_id": c[1],
            "name": "" if contact[0] is None else contact[0].encode("ascii", "ignore").decode(),
            "number": contact[1]
        })

    for mess in messages_db:
        messages.append({
            "type": "incoming" if mess[1] == 0 else "outgoing",
            "subject": "" if mess[2] is None else mess[1],
            "body": "" if mess[3] is None else mess[3],
            "payload_path": "" if mess[4] is None else mess[4],
            "info": "" if mess[5] is None else mess[5],
            "parties": chats[str(mess[0])]
        })

    return messages

def getAllData():
    if not os.path.exists(AppData + "\\Roaming\\ViberPC\\"):
        return {
            "contacts": [],
            "messages": []
        }

    path = getPath()

    return {
        "contacts": getContacts(path),
        "messages": getMessages(path)
    }