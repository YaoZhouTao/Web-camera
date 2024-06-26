'use strict';

//join 主动加入房间
//leave 主动离开房间
//new_peer 有人加入房间，通知已经在房间的人
//peer-leave 有人离开房间，通知已经在房间的人
//offer 发送offer给对端peer
//answer 发送offer给对端peer
//candidate 发送candidate给对点peer
var isConnected = false;
var maxWaitTime = 10000; // 最大等待时间，单位毫秒

const SIGNAL_TYPE_JOIN = "join"; 
const SIGNAL_TYPE_RESP_JOIN = "resp-join";  //告知加入者对方是谁
const SIGNAL_TYPE_LEAVE = "leave";
const SIGNAL_TYPE_NEW_PEER = "new-peer";
const SIGNAL_TYPE_PEER_LEAVE = "peer-leave";
const SIGNAL_TYPE_OFFER = "offer";
const SIGNAL_TYPE_ANSWER = "answer";
const SIGNAL_TYPE_CANDIDATE = "candidate";

var localUserId = Math.random().toString(36).substring(2); //本地UID
var remoteUserId = -1; //对端uid
var roomId = 0;

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remotelVideo');
var localStream = null;     //本地流9++++++++

var remoteStream = null;       //远端流
var pc = null;

var SXTUID = null;

var zeroRTCEngine;

var DialogueId = 0;

var nDataType = 1;

var remoteVideo = document.querySelector('#remotelVideo');
function handleRemoteStreamAdd(event){
    remoteStream = event.streams[0];
    remoteVideo.srcObject = remoteStream;
    if(remoteStream != null){
        console.log("连接摄像头成功");
    }
}

function handleconnectionstatechange(){
    console.info("iceconnectionstate -> ------------------------------------------------");
   if(pc != null){
        console.info("connectionstate -> " + pc.connectionState);
    }
}

function handleiceconnectionstatechange(){
    console.info("iceconnectionstate -> +++++++++++++++++++++++++++++++++++++++++++++++++");
    if(pc != null){
        console.info("iceconnectionstate -> " + pc.iceConnectionState);
    }
}

function handleTceCandidate(event){
    //console.info("handleTceCandidate");
    if(event.candidate){
        var jsonMsg = {
            'DevId': SXTUID,
            'method': "AddCandidate",
            'data':{
                "DialogueId": DialogueId,     //会话ID
                "candidate": event.candidate.candidate,
                "sdpMid": "0",
                "sdpMLineIndex": 0
            }
        };
        var message = JSON.stringify(jsonMsg);
        zeroRTCEngine.sendMessage(message);
        console.info("成功发送candiate");
    }else{
        console.warn("End of candidates");
    }
}

function createPeerConnection(){
    var defaultConfiguration = {
        // bundlePolicy: "max-bundle",
        // rtcpMuxPolicy: "require",
        // iceTransportPolicy: "relay",       //relay 或者 all 
        //修改ice数组测试效果，需要进行封装
        iceServers: [
            // {
            //     "urls": [
            //         "turn:101.42.12.250:3478?transport=udp",
            //         "turn:101.42.12.250:3478?transport=tcp"
            //     ],
            //     "username": "xutao",
            //     "credential": "123456"
            // },
            // {
            //     "urls": [
            //         "stun:101.42.12.250:3478"
            //     ]
            // }
            { 
                'urls': 'turn:'+ "192.144.215.114:3478",
                'username': "rzyk",
                'credential': "123456"
           }

        ]
    };
    pc = new RTCPeerConnection(defaultConfiguration);
    pc.onicecandidate = handleTceCandidate;
    pc.ontrack = handleRemoteStreamAdd;
    pc.onconnectionstatechange = handleconnectionstatechange;
    pc.oniceconnectionstatechange = handleiceconnectionstatechange;

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
}

function createOfferAndSendMessage(session){
    
    pc.setLocalDescription(session)
        .then(function(){
            var jsonMsg = {
                'cmd': 'offer',
                'webid': localUserId,
                'sn': SXTUID,
                'msg': JSON.stringify(session)
            };
            var message = JSON.stringify(jsonMsg);
            zeroRTCEngine.sendMessage(message);
            //console.info("send offer message: "+ message);
            console.info("成功发送offer");

        })
        .catch(function(error){
            console.error("offer setLocalDescription failed: " + error);
        });
}

function handleCreateOfferError(error){
    console.error("发送offer失败" + error);
}



function createAnswerAndSendMessage(session){

    pc.setLocalDescription(session)
        .then(function(){
            var jsonMsg = {
                "DevId":SXTUID, //设备ID
                "method":"SetRtcSdpAnser",//方法ID
                "data":{
                    "DialogueId":DialogueId, //rtc会话ID
                    "sdp": session.sdp,
                    "type": "answer"
                }        
            };
            var message = JSON.stringify(jsonMsg);
            zeroRTCEngine.sendMessage(message);
            //console.info("send answer message: "+ message);
            console.info("answer发送成功");
        })
        .catch(function(error){
            console.error("answer setLocalDescription failed: " + error);
        });
}

function handleCreateAnswerError(error){
    console.error("answer setLocalDescription failed: " + error);
}

function requirdcandidate(){
    var jsonMsg = {
        "DevId":SXTUID, //设备ID
        "method":"GetCandis",//方法ID
        "data":{
            "DialogueId":DialogueId, //会话ID
        }    
    };
    var message = JSON.stringify(jsonMsg);
    zeroRTCEngine.sendMessage(message);
    //console.info("send answer message: "+ message);
    console.info("请求candidate发送成功");
}

var ZeroRTCEngine = function(wsUrl){
    this.init(wsUrl);
    zeroRTCEngine = this;
    return this;
}

ZeroRTCEngine.prototype.init = function(wsUrl){
    //设置websocket url
    this.wsUrl = wsUrl;
    /* wensocket 对象*/
    this.signaling = null;
}

ZeroRTCEngine.prototype.createWebsocket = function(){
    zeroRTCEngine = this;
    zeroRTCEngine.signaling = new WebSocket(this.wsUrl);

    zeroRTCEngine.signaling.onopen = function(){
        zeroRTCEngine.onOpen();
    }

    zeroRTCEngine.signaling.onmessage = function(ev){
        zeroRTCEngine.onMessage(ev);
    }

    zeroRTCEngine.signaling.onerror = function(ev){
        zeroRTCEngine.onError(ev);
    }

    zeroRTCEngine.signaling.onclose = function(ev){
        zeroRTCEngine.onClose(ev);
    }
}

ZeroRTCEngine.prototype.onOpen = function(){
    console.log("wensocket open");
    isConnected = true;
    var jsonMsg = {
        "DevId":localUserId, //设备ID
        "method":"webconnect"//方法ID    
    };
    var message = JSON.stringify(jsonMsg);
    zeroRTCEngine.sendMessage(message);
     // 每隔10秒发送心跳消息
     setInterval(() => {
        var jsonMsg = {
            "DevId":localUserId, //设备ID
            "method":"hearbeat"//方法ID    
        };
        var message = JSON.stringify(jsonMsg);
        zeroRTCEngine.sendMessage(message);
    }, 10000);
}

ZeroRTCEngine.prototype.onMessage = function(event){
    console.log("onMessage: " + event.data);
    try{
        var jsonMsg = JSON.parse(event.data);
    }catch(e){
        console.warn("onMessage parse Josn failed:" + e);
        return;
    }

    switch(jsonMsg.method){
        // case SIGNAL_TYPE_NEW_PEER:
        //     handleRemoteNewPeer(jsonMsg);
        //     break;
        // case SIGNAL_TYPE_RESP_JOIN:
        //     handleResponseJoin(jsonMsg);
        //     break;
        // case SIGNAL_TYPE_PEER_LEAVE:
        //     handleRemotePeerLeave(jsonMsg);
        //     break;
        // case SIGNAL_TYPE_OFFER:
        //     //handleRemoteOffer(jsonMsg);
        //     break;
        // case SIGNAL_TYPE_ANSWER:
        //     handleRemoteAnswer(jsonMsg);
        //     break;
        case "GetCandis":
            handleRemoteCandidate(jsonMsg);
            break;        
        case "GetRtcSdpOffer":
            handleRemoteOffer(jsonMsg);
            break;
        case "answerOK":
            requirdcandidate();
            break;
        case "sxt_Not_Online":
            sxt_Not_Online();
            break;
    }
}

function sxt_Not_Online(){
    console.log("进入sxt_Not_Online");
    // 创建一个新的div元素
    var statusText = document.getElementById('statusText');
    statusText.textContent = '设备不在线或者设备未接入网络，请检查设备是否插电并连接网络';
    statusText.style.display = 'block';
    setTimeout(function() {
        statusText = document.getElementById('statusText');
        statusText.style.display = 'none';
    }, 10000);
}


ZeroRTCEngine.prototype.onError = function(event){
    console.log("onError: " + event.data);
}

ZeroRTCEngine.prototype.onClose = function(event){
    console.log("onClose -> code:  " + event.code + ", reason: " + EventTarget.reason);
}

ZeroRTCEngine.prototype.sendMessage = function(message){
    this.signaling.send(message);
}

function handleResponseJoin(message){
    console.info("handleResponseJoin, remoteUid: " + message.remoteUid);
    remoteUserId = message.remoteUid;
    // doOffer();
}
 
function handleRemotePeerLeave(message){
    console.info("handleRemotePeerLeave, remoteUid: " + message.remoteUid);
    remoteVideo.srcObject = null;
    if(pc != null){
        pc.close();
        pc = null;
    }
}

function handleRemoteNewPeer(message){
    console.info("handleRemoteNewPeer, remoteUid: " + message.remoteUid);
    remoteUserId = message.remoteUid;
    doOffer();
}

function handleRemoteOffer(message){
    console.info("收到摄像头offer");
    if(pc == null){
        createPeerConnection();
    }

    var jsonObj = {type:"offer",sdp:message.data.ipcsdp};
    DialogueId = message.data.DialogueId;  
    pc.setRemoteDescription(new RTCSessionDescription(jsonObj));
    doAnswer();
}

function handleRemoteAnswer(message){
    console.info("handleRemoteAnswer");
    var desc = JSON.parse(message.msg);
    pc.setRemoteDescription(desc);
}

function handleRemoteCandidate(message){
    console.log("收到摄像头ice = " + message);
    console.log(message);

    var msg =message.data;
    if(msg.status==200){
        console.log("GetCandis:"+JSON.stringify(msg));
        if(msg.cands.length==0) 
        {
            if(msg.cands.IceStatus==2)
            {
                alert("ice server timeout");
            }else  if(msg.cands.IceStatus==1){
                    alert("ice server err pass");
            }else{
                //requirdcandidate(); 
                console.log("ice获取失败");
            }
        }else{
            for(var i=0;i<msg.cands.length;i++) {
                 var Item =msg.cands[i];
                 var sss={candidate:Item,sdpMid:"0",sdpMLineIndex:0};
                 console.log(JSON.stringify(sss));
                 var remotecan = new RTCIceCandidate(sss);
                 pc.addIceCandidate(remotecan).catch(e => 
                 {
                    console.log("Failure during addIceCandidate(): " + e.name);
                 });
            }
        }
         
    }else{
         alert("GetDevIceCandidates not find DialogueId");
         alert(msg);
    }	


    // pc.addIceCandidate(message.data.cands).catch(e =>{
    //     console.error("addIceCandidate failed:" + e.name);
    // });
}

function doOffer(){
    //创建RTCPeerConnection
    if(pc == null)
    {
        createPeerConnection();
    }
    pc.createOffer().then(createOfferAndSendMessage).catch(handleCreateOfferError);
}

function doAnswer(){
    pc.createAnswer().then(createAnswerAndSendMessage).catch(handleCreateAnswerError);
}

function doJoin(){
    console.log("进入dojoin");
    var jsonMsg = {
        'DevId': SXTUID,
        'method': "GetRtcSdpOffer",
        'data':{
            'iceurl': "192.144.215.114:3478",
            'iceuname': "rzyk", 
            'iceupass': "123456", 
            'icerealm':"realm",//固定
            'audio':1,
            'video':1
        }
    };
    var message = JSON.stringify(jsonMsg);
    zeroRTCEngine.sendMessage(message);
    console.info("已经发送请求设备offer message = " + message);
}

function doLeave(){
    var jsonMsg = {
        'method': 'leave',
        'sn': SXTUID,
        'webid':localUserId
    };
    var message = JSON.stringify(jsonMsg);
    zeroRTCEngine.sendMessage(message);
    hangup();
    console.info("doLeave message: "+ message);
}

function hangup(){
    localVideo.srcObject = null; //关闭自己的本地显示
    remoteVideo.srcObject = null; //关闭对方流
    closeLocalStream(); //关闭本地流
    if(pc != null){
        pc.close(); //关闭RTCPeerConnection
        pc = null;
    }
    SXTUID = null;
}

function closeLocalStream(){
    if(localStream != null){
        localStream.getTracks().forEach((track) => {
            track.stop();
        })
    }
    localStream = null;
}

function openLocalStream(stream){
    console.log('Open local stream');
    localVideo.srcObject = stream;
    localStream = stream;
    var startTime = new Date().getTime();
    if(isConnected === true){
        doJoin();
    }else{
        var statusText = document.getElementById('statusText');
        statusText.textContent = '正在连接服务器，请等待...';
        statusText.style.display = 'block';
        checkConnection(startTime);
    }
}

// 检查WebSocket连接状态的函数
function checkConnection(startTime) {
    if (isConnected === true) {
        doJoin();
        var statusText = document.getElementById('statusText');
        statusText.style.display = 'none';
        return;
    } else {
        console.log("正在连接服务器，请等待");
        var currentTime = new Date().getTime();
        if (currentTime - startTime < maxWaitTime) {
            // 继续等待，每秒检查一次
            setTimeout(function () {
                checkConnection(startTime);
            }, 1000);
            return;
        } else {
            // 等待超时，提示服务器异常
            var statusText = document.getElementById('statusText');
            statusText.style.display = 'none';
            statusText.textContent = '服务器异常，无法建立WebSocket连接，请检查网络是否正常连接并刷新尝试重连';
            statusText.style.display = 'block';

            setTimeout(function() {
                statusText = document.getElementById('statusText');
                statusText.style.display = 'none';
            }, 5000);
        }
    }
}


function initLocalStream() {
    // 检查浏览器是否支持 getUserMedia
    if (typeof navigator.mediaDevices !== 'undefined' && typeof navigator.mediaDevices.getUserMedia === 'function') {
        navigator.mediaDevices.getUserMedia({
            audio: true
            // video: true
        })
        .then(openLocalStream)
        .catch(function(e) {
            alert("getUserMedia() && dojoin error: " + e.name + "代码故障请联系开发人员");
        });
    } else {
        alert("当前浏览器不支持getUserMedia函数，建议使用华为或者谷歌浏览器");
    }
}

zeroRTCEngine = new ZeroRTCEngine("ws://192.144.215.114:20044");

// zeroRTCEngine = new ZeroRTCEngine("wss://hrbrzyk.com:20046/sxt");
// zeroRTCEngine = new ZeroRTCEngine("ws://101.42.12.250:9999");
// zeroRTCEngine = new ZeroRTCEngine("wss://101.42.12.250:8098/ws");

// setTimeout(function() {
//     console.log("程序休眠两秒后执行的任务");
//     zeroRTCEngine.createWebsocket();
// }, 20000); // 2000毫秒（2秒）后执行

zeroRTCEngine.createWebsocket();
// SXTUID = '555';
// initLocalStream();
document.getElementById('joinBtn').onclick = function(){
    SXTUID = document.getElementById('zero-RoomID').value;
    if(SXTUID =="" || SXTUID == "请输入摄像头UID"){
        alert("请输入摄像头UID");
        return;
    }
    console.log("加入按钮被点击, SXTUID: " + SXTUID);
    //初始化本地流
    initLocalStream();
}

document.getElementById('leavBtn').onclick = function(){
    console.log("离开按钮被点击");
    doLeave();
}

//打开摄像头
// function Open_sxt(SXT_ID){
//     SXTUID = SXT_ID;
//     initLocalStream();
// }

// //关闭摄像头
// function Stop_sxt(){
//     doLeave();
// }

// Open_sxt(555);