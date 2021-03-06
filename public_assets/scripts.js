var pusher = new Pusher("1409758434688f81ddb0", {
    cluster: "us2",
    encrypted: true,
    authEndpoint: "pusher/auth"
});
var usersOnline,
    id,
    users = [],
    sessionDesc,
    currentcaller,
    room,
    caller,
    localUserMedia;
const channel = pusher.subscribe("presence-videocall");

channel.bind("pusher:subscription_succeeded", members => {
    //set the member count
    usersOnline = members.count;
    id = channel.members.me.id;
    document.getElementById("myid").innerHTML = ` My caller id is : ` + id;
    members.each(member => {
        if (member.id != channel.members.me.id) {
            users.push(member.id);
        }
    });

    render();
});

channel.bind("pusher:member_added", member => {
    users.push(member.id);
    render();
});

channel.bind("pusher:member_removed", member => {
    // for remove member from list:
    var index = users.indexOf(member.id);
    users.splice(index, 1);
    if (member.id == room) {
        endCall();
    }
    render();
});

function render() {
    var list = "";
    users.forEach(function(user) {
        list +=
            `<li>` +
            user +
            ` <input type="button"  value="Call" onclick="callUser('` +
            user +
            `')" id="makeCall" /></li>`;
    });
    document.getElementById("users").innerHTML = list;
}

//To iron over browser implementation anomalies like prefixes
GetRTCPeerConnection();
GetRTCSessionDescription();
GetRTCIceCandidate();
prepareCaller();
function prepareCaller() {
    //Initializing a peer connection
    caller = new window.RTCPeerConnection();
    //Listen for ICE Candidates and send them to remote peers
    caller.onicecandidate = function(evt) {
        if (!evt.candidate) return;
        console.log("onicecandidate called");
        onIceCandidate(caller, evt);
    };
    //onaddstream handler to receive remote feed and show in remoteview video element
    caller.onaddstream = function(evt) {
        console.log("onaddstream called");
        if (window.URL) {
            //document.getElementById("remoteview").src = window.URL.createObjectURL(evt.stream);
            document.getElementById("remoteview").srcObject = evt.stream;
        } else {
            document.getElementById("remoteview").src = evt.stream;
        }
    };
}
function getCam() {
    //Get local audio/video feed and show it in selfview video element
    if (navigator.mediaDevices.getDisplayMedia){
        //chrome 70+
        return navigator.mediaDevices.getDisplayMedia({
            video: true
        });
    }else{
        //firefox
        console.log("Unable to acquire chrome extensionless screen capture, trying firefox approach");
        return navigator.mediaDevices.getUserMedia({
            video: {mediaSource: "screen"}
        });
    }
}

function GetRTCIceCandidate() {
    window.RTCIceCandidate =
        window.RTCIceCandidate ||
        window.webkitRTCIceCandidate ||
        window.mozRTCIceCandidate ||
        window.msRTCIceCandidate;

    return window.RTCIceCandidate;
}

function GetRTCPeerConnection() {
    window.RTCPeerConnection =
        window.RTCPeerConnection ||
        window.webkitRTCPeerConnection ||
        window.mozRTCPeerConnection ||
        window.msRTCPeerConnection;
    return window.RTCPeerConnection;
}

function GetRTCSessionDescription() {
    window.RTCSessionDescription =
        window.RTCSessionDescription ||
        window.webkitRTCSessionDescription ||
        window.mozRTCSessionDescription ||
        window.msRTCSessionDescription;
    return window.RTCSessionDescription;
}

//Create and send offer to remote peer on button click
function callUser(user) {
    getCam()
    .then(function(stream) {
        if (window.URL) {
            //document.getElementById("selfview").src = window.URL.createObjectURL(stream);
            document.getElementById("selfview").srcObject = stream;
        } else {
            document.getElementById("selfview").src = stream;
        }
        toggleEndCallButton();
        caller.addStream(stream);
        localUserMedia = stream;
        caller.createOffer().then(function(desc) {
            caller.setLocalDescription(new RTCSessionDescription(desc));
            channel.trigger("client-sdp", {
                sdp: desc,
                room: user,
                from: id
            });
            room = user;
        });
    })
    .catch(error => {
        console.log("an error occured", error, error.message);
        if (error.name == "NotAllowedError"){
            //catch error that comes from running on mobile
            alert("Sorry, screen capture is not supported on this platform");
            //cancel this call
            endCall();
        }else{
            throw err;
        }
    });
}

function endCall() {
    room = undefined;
    caller.close();
    for (let track of localUserMedia.getTracks()) {
        track.stop();
    }
    prepareCaller();
    
    //clear video element (sometimes stuck on firefox)
    document.getElementById("selfview").removeAttribute('src');
    document.getElementById("remoteview").removeAttribute('src');
    document.getElementById("selfview").load()
    document.getElementById("remoteview").load()
    
    toggleEndCallButton();
}

function endCurrentCall() {
    channel.trigger("client-endcall", {
        room: room
    });

    endCall();
}

//Send the ICE Candidate to the remote peer
function onIceCandidate(peer, evt) {
    if (evt.candidate) {
        channel.trigger("client-candidate", {
            candidate: evt.candidate,
            room: room
        });
    }
}

function toggleEndCallButton() {
    if (document.getElementById("endCall").style.display == "block") {
        document.getElementById("endCall").style.display = "none";
    } else {
        document.getElementById("endCall").style.display = "block";
    }
}

//Listening for the candidate message from a peer sent from onicecandidate handler
channel.bind("client-candidate", function(msg) {
    if (msg.room == room) {
        console.log("candidate received");
        function tryAddIceCandidate(){ 
            if(caller.currentRemoteDescription){
                console.log("addIceCandidate successful!");
                caller.addIceCandidate(new RTCIceCandidate(msg.candidate));
            }else{
                setTimeout(function(){
                   console.log("waiting for remoteDescription to be set...");
                }, 1000)
            }
                
        }
        tryAddIceCandidate();
        
    }
});

//Listening for Session Description Protocol message with session details from remote peer
channel.bind("client-sdp", function(msg) {
    if (msg.room == id) {
        console.log("sdp received");
        var answer = confirm(
            "You have a call from: " + msg.from + "Would you like to answer?"
        );
        if (!answer) {
            return channel.trigger("client-reject", { room: msg.room, rejected: id });
        }
        room = msg.room;
        getCam()
            .then(stream => {
            localUserMedia = stream;
            toggleEndCallButton();
            if (window.URL) {
                //document.getElementById("selfview").src = window.URL.createObjectURL(stream);
                document.getElementById("selfview").srcObject = stream;
            } else {
                document.getElementById("selfview").src = stream;
            }
            caller.addStream(stream);
            var sessionDesc = new RTCSessionDescription(msg.sdp);
            caller.setRemoteDescription(sessionDesc);
            caller.createAnswer().then(function(sdp) {
                caller.setLocalDescription(new RTCSessionDescription(sdp));
                channel.trigger("client-answer", {
                    sdp: sdp,
                    room: room
                });
            });
        })
        .catch(error => {
            console.log("an error occured", error, error.message);
            if (error.name == "NotAllowedError"){
                //catch error that comes from running on mobile
                alert("Sorry, screen capture is not supported on this platform");
                //cancel this call, and notify the other client that we have hung up 
                endCurrentCall();
            }else{
                throw err;
            }
        });
    }
});

//Listening for answer to offer sent to remote peer
channel.bind("client-answer", function(answer) {
    if (answer.room == room) {
        console.log("answer received");
        caller.setRemoteDescription(new RTCSessionDescription(answer.sdp));
    }
});

channel.bind("client-reject", function(answer) {
    if (answer.room == room) {
        console.log("Call declined");
        alert("call to " + answer.rejected + "was politely declined");
        endCall();
    }
});

channel.bind("client-endcall", function(answer) {
    if (answer.room == room) {
        console.log("Call Ended");
        endCall();
    }
});