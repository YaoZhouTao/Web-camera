可以与webrtc摄像头视频语音通话
没有加降噪和语音识别
对应的信令服务器为：/home/ubuntu/webrtc/node/server/one_to_one_server/sxtserver.js
turn服务器启动过程：
1.cd /root/coturn/coturn
2.sudo nohup turnserver -L 0.0.0.0 -a -u rzyk:123456 -v -f -r nort.gov &