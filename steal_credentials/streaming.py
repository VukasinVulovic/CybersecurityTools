import os
import json

AppData = os.environ["USERPROFILE"] + "\\AppData"

def getAllData():
    def obsKey():
        path = AppData + "\\Roaming\\obs-studio\\basic\\profiles\\"

        if not os.path.exists(path):
            return []

        keys = []
        
        for profile in os.listdir(path):
            with open(path + profile + "\\service.json") as f:
                file = f.read()
                file = json.loads(file)

                keys.append({
                    "service": file["settings"]["service"],
                    "key": file["settings"]["key"]
                })

                f.close()

        return keys

    def streamlabsKey():
        path = AppData + "\\Roaming\\slobs-client\\service.json"

        if not os.path.exists(path):
            return []

        keys = []

        with open(path) as f:
            file = f.read()
            file = json.loads(file)

            keys.append({
                "service": file["settings"]["service"],
                "key": file["settings"]["key"]
            })

        return keys

    return {
        "obs": obsKey(),
        "streamlabs": streamlabsKey()
    }