var ws = require("nodejs-websocket")
var port = 9999;

//join 主动加入房间
//leave 主动离开房间
//new_peer 有人加入房间，通知已经在房间的人
//peer-leave 有人离开房间，通知已经在房间的人
//offer 发送offer给对端peer
//answer 发送offer给对端peer
//candidate 发送candidate给对点peer
const SIGNAL_TYPE_JOIN = "join"; 
const SIGNAL_TYPE_RESP_JOIN = "resp-join";  //告知加入者对方是谁
const SIGNAL_TYPE_LEAVE = "leave";
const SIGNAL_TYPE_NEW_PEER = "new-peer";
const SIGNAL_TYPE_PEER_LEAVE = "peer-leave";
const SIGNAL_TYPE_OFFER = "offer";
const SIGNAL_TYPE_ANSWER = "answer";
const SIGNAL_TYPE_CANDIDATE = "candidate";

/* ------- ZeroRTCMap -------*/ 
var ZeroRTCMap = function(){
    this._entrys = new Array();

    this.put = function(key, value){
        if(key == null || key == undefined){
            return;
        }
        var index = this._getIndex(key);
        if(index == -1){
            var entry = new Object();
            entry.key = key;
            entry.value = value;
            this._entrys[this._entrys.length] = entry;
        }else{
            this._entrys[index.value] = value;
        }
    };
    this.get = function(key){
        var index = this._getIndex(key);
        return (index != -1) ? this._entrys[index].value : null;
    };
    this.remove = function(key){
        var index = this._getIndex(key);
        if(index != -1){
            this._entrys.splice(index, 1);
        }
    };
    this.clear = function(){
        this._entrys.length = 0;
    };
    this.contains = function(key){
        var index = this._getIndex(key);
        return (index != -1) ? true : false;
    };
    this.size = function(){
        return this._entrys.length;
    };
    this._getEntrys = function(){
        return this._entrys;
    };
    this._getIndex = function(key){
        if(key == null || key == undefined){
            return -1;
        };
        var _length = this._entrys.length;
        for(var i = 0;i < _length;i++){
            var entry = this._entrys[i];
            if(entry == null || entry == undefined){
                continue;
            }
            if(entry.key == key){
                return i;
            }
        }
        return -1;
    };
}

var roomTableMap = new ZeroRTCMap();

function Client(uid, conn, roomId){
    this.uid = uid;
    this.conn = conn;
    this.roomId = roomId;
}

function SXTClient(sn, conn, webconn){
    this.uid = sn;
    this.conn = conn;
    this.webconn = webconn;
}

function handleJoin(message, conn){
    var roomId = message.roomId;
    var uid = message.uid;

    console.info("uid: " + uid + "try to join room" + roomId);

    var roomMap = roomTableMap.get(roomId);
    if(roomMap == null){
        roomMap = new ZeroRTCMap();
        roomTableMap.put(roomId, roomMap);
    }

    if(roomMap.size() >= 2){
        console.error("roomId: " + roomId + " 已经有两个人存在，请使用其他房间");
        //加信令通知客户端，房间已经满了
        return null;
    }

    var client = new Client(uid, conn, roomId);
    roomMap.put(uid, client);
    if(roomMap.size() > 1){
        //房间里面已经有人了，加上新进来的人就有两个人了，所以要通知对方
        var clients = roomMap._getEntrys();
        for(var i in clients){
            var remoteUid = clients[i].key;
            if(remoteUid != uid){
                var jsonMsg = {
                    'cmd': SIGNAL_TYPE_NEW_PEER,
                    'remoteUid': uid
                };
                var msg = JSON.stringify(jsonMsg);
                var remoteClient = roomMap.get(remoteUid);
                console.info("new-peer: " + msg);
                remoteClient.conn.sendText(msg);

                jsonMsg = {
                    'cmd': SIGNAL_TYPE_RESP_JOIN,
                    'remoteUid': remoteUid
                };
                msg = JSON.stringify(jsonMsg);
                console.info("resp-peer: " + msg);
                conn.sendText(msg);
            }
        }
    }
    return client;
}

function handleLeave(message){
    var roomId = message.roomId;
    var uid = message.uid;

    console.info("uid: " + uid + "leave room" + roomId);

    var roomMap = roomTableMap.get(roomId);
    if(roomMap == null){
        console.error("handleleave can't find then roomId " + roomId);
        return;
    }
    roomMap.remove(uid); //删除发送者
    if(roomMap.size() >= 1){
        var clients = roomMap._getEntrys();
        for(var i in clients){
            var jsonMsg = {
                'cmd': 'peer-leave',
                'remoteUid': uid   //谁离开填写谁
            };
            var msg = JSON.stringify(jsonMsg);
            var remoteUid = clients[i].key;
            var remoteClient = roomMap.get(remoteUid);
            if(remoteClient){
                console.info("notify peer: " + remoteClient.uid + ", uid: " + uid + "leave");
                remoteClient.conn.sendText(msg);
            }
        }
    }
}

function handleForceLeave(client){
    var roomId = client.roomId;
    var uid = client.uid;

    //1.先查找房间号
    var roomMap = roomTableMap.get(roomId);
    if(roomMap == null){
        console.warn("handleForceLeave can't find then roomId " + roomId);
        return;
    }

    //2.判别uid是否在房间
    if(!roomMap.contains(uid)){
        console.info("uid: " + uid + "have leave roomId" + roomId);
        return;
    }

    //3.到这里，说明客户端没有正常离开
    console.info("uid: " + uid + "force leave room" + roomId);

    roomMap.remove(uid); //删除发送者
    if(roomMap.size() >= 1){
        var clients = roomMap._getEntrys();
        for(var i in clients){
            var jsonMsg = {
                'cmd': 'peer-leave',
                'remoteUid': uid   //谁离开填写谁
            };
            var msg = JSON.stringify(jsonMsg);
            var remoteUid = clients[i].key;
            var remoteClient = roomMap.get(remoteUid);
            if(remoteClient){
                console.info("notify peer: " + remoteClient.uid + ", uid: " + uid + "leave");
                remoteClient.conn.sendText(msg);
            }
        }
    }
}

function handleOffer(message,conn){
    var SN = message.sn;
    var webid = message.webid;

    var roomMap = roomTableMap.get(SN);
    if(roomMap  == null){
        //等于空说明摄像头不在线通知web端
        var jsonMsg = {
            'cmd': 'nofind',
        };
        var msg = JSON.stringify(jsonMsg);
        conn.sendText(msg);
        return;
    }else{
        var sxtclient = roomMap.get(SN);
        if(sxtclient){
            sxtclient.webconn = conn;
            var msg = JSON.stringify(message);
            sxtclient.conn.sendText(msg);
        }else{
            console.error("摄像头不在线: " + SN);
        }
        console.info("收到webid" + webid + "的offer, 发往摄像头 SN: " + SN);
    }
}

function handleAnswer(message){
    var SN = message.sn;
    var webid = message.webid;

    var roomMap = roomTableMap.get(SN);
    if(roomMap  == null){
       console.log("服务器故障, 设备在线但是检测不到");
    }else{
        var sxtclient = roomMap.get(SN);
        if(sxtclient){
            var msg = JSON.stringify(message);
            sxtclient.webconn.sendText(msg);
        }else{
            console.error("摄像头不在线: " + SN);
        }
        console.info("收到摄像头" + SN + "的answer, 发往web : " + webid);
    }
}

function handleCandidate(message,conn){
    var SN = message.sn;
    var webid = message.webid;

    var roomMap = roomTableMap.get(SN);
    if(roomMap  == null){
       console.log("服务器代码出现严重错误请立即修复");
    }else{
        var sxtclient = roomMap.get(SN);
        if(sxtclient != null && conn === sxtclient.conn){ //说明是摄像头发来的ICE要发往WEB
            var msg = JSON.stringify(message);
            sxtclient.webconn.sendText(msg);
            console.info("收到摄像头" + SN + "的candiate, 发往web : " + webid);
        }else if(sxtclient != null && conn === sxtclient.webconn){//说明是WEB发来的ICE要发往摄像头
            var msg = JSON.stringify(message);
            sxtclient.conn.sendText(msg);
            console.info("收到WEB" + webid + "的candiate, 发往摄像头 SN: " + SN);
        }
    }
}

function handleconnect(message,conn){
    var SN = message.sn;
    //查找摄像头是否已经存在
    var roomMap = roomTableMap.get(SN);
    if(roomMap == null){ 
        roomMap = new ZeroRTCMap(); //如果摄像头不存在就为摄像头创建一个房间
        roomTableMap.put(SN, roomMap);
    }
    
    var sxtclient = new SXTClient(SN, conn, null);
    roomMap.put(SN, sxtclient);
    console.log("摄像头" + SN +"成功连接服务器并已成功创建房间");
}

varserver = ws.createServer(function(conn){
    console.log("创建一个新的连接---------");
    conn.client = null;
    //conn.sendText("我收到你的连接了。。。");
    conn.on("text", function(str){
        //console.info("recv msg: " + str);
        var jsonMsg = JSON.parse(str);

        switch(jsonMsg.cmd){
            case SIGNAL_TYPE_JOIN:
                conn.client = handleJoin(jsonMsg,conn);
                break;
            case SIGNAL_TYPE_LEAVE:
                handleLeave(jsonMsg);
                break;
            case SIGNAL_TYPE_OFFER:
                handleOffer(jsonMsg,conn);
                break;
            case SIGNAL_TYPE_ANSWER:
                handleAnswer(jsonMsg);
                break;
            case SIGNAL_TYPE_CANDIDATE:
                handleCandidate(jsonMsg,conn);
                break;
            case "connect":
                handleconnect(jsonMsg,conn);
                break;
        }

    });

    conn.on("close", function(code, reason){
        console.info("连接关闭 code: " + code + ", reason: " + reason);
        if(conn.client != null){
            handleForceLeave(conn.client);
        }
    });

    conn.on("erroe", function(err){
        console.info("监听到错误：" + err);
    });
}).listen(port);