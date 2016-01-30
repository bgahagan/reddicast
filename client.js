'use strict';

var reddicast = reddicast || {};

reddicast.castAvailiable = new Promise(function (onSuccess, onError) {
  window['__onGCastApiAvailable'] = function(loaded, errorInfo) {
    console.log("GCastApiAvailable", loaded, errorInfo);
    if (loaded) {
      onSuccess();
    } else {
      onError("onError: " + errorInfo);
    }
  }
});

reddicast.castNamespace_ = 'urn:x-cast:reddicast';

reddicast.castSessionListener = function(session) {
  
  function receiverMessage(namespace, message) {
    appendMessage("receiverMessage: "+namespace+", "+message);
  }
  
  appendMessage('New session ID:' + session.sessionId);
  session.addUpdateListener(reddicast.castSessionUpdateListener.bind(null, session));  
  session.addMessageListener(reddicast.castNamespace_, receiverMessage);
  // castSession_ can be null if the session is remotely initiated
  if (reddicast.castSession_ === null || !reddicast.castSession_.state === 'pending') {
    reddicast.castSession_ = util.deferred();
  }
  reddicast.castSession_.resolve(session);
}

reddicast.castSessionUpdateListener = function(session, isAlive) {
  var message = isAlive ? 'Session Updated' : 'Session Removed';
  message += ': ' + session.sessionId;
  if (!isAlive) {
    reddicast.castSession_ = null;
  }
  appendMessage(message);
}

// Receiver state - will always be a deferred
reddicast.castReceiver_ = util.deferred();

reddicast.castWaitReceiver = function() {
  return reddicast.castReceiver_.promise;
}

/**
 * initialization
 */
reddicast.castInitialize = function() {
   
    function receiverListener(e) {
      if( e === chrome.cast.ReceiverAvailability.AVAILABLE ) {
        if (reddicast.castReceiver_.state === 'rejected') {
          reddicast.castReceiver_ = util.deferred();
        }
        reddicast.castReceiver_.resolve("receiver available")
      } else {
        if (reddicast.castReceiver_.state === 'resolved') {
          reddicast.castReceiver_ = util.deferred();
        }
        reddicast.castReceiver_.reject("receiver list empty")
      }
    }
  
		var applicationID = '099825BA';	
		var apiConfig = new chrome.cast.ApiConfig(
      new chrome.cast.SessionRequest(applicationID),
			reddicast.castSessionListener,
			receiverListener,
      chrome.cast.AutoJoinPolicy.TAB_AND_ORIGIN_SCOPED,
      chrome.cast.DefaultActionPolicy.CREATE_SESSION);
		return util.promisify(chrome.cast.initialize.bind(null, apiConfig));
};

reddicast.castRequestSession = function() {
  console.log("requesting session");
  return util.promisify(chrome.cast.requestSession)
    .then(reddicast.castSessionListener);
}

// Null if not connected, otherwise its a deferred
reddicast.castSession_ = null;
 
reddicast.getSession = function() {
  if (reddicast.castSession_ === null) {
    reddicast.castSession_ = util.deferred();
    reddicast.castRequestSession();
  }
  return reddicast.castSession_.promise;
}

reddicast.queuePost = function(postId) {
  return reddicast.castSend({
    'action': 'queue',
    'postId': postId
  });
}

reddicast.next = function(postId) {
  return reddicast.castSend({
    'action': 'next'
  });
}
  
reddicast.castSend = function(message) {
  return reddicast.getSession()
    .then(function(session) {
      return util.promisify(session.sendMessage.bind(session, reddicast.castNamespace_, message));
    });
}

/**
 * append message to debug message window
 * @param {string} message A message string
 */
function appendMessage(message) {
  console.log(message);
};

// Init and create a session now
reddicast.castAvailiable
  .then(reddicast.castInitialize)
  .then(reddicast.castWaitReceiver)
  .then(function (e) {
    console.log("receiver available", e);
  })
  /*.then(util.promiseAwait.bind(null, 200))
  .then(reddicast.getSession)*/
  .then(function (e) {
    console.log("finished connecting", e);
  })
  .catch(function (e) {
    console.log('could not create cast', e);
  });
  
window.onload = function() {
  var r = new reddicast.SubReddit('videos');
  r.hot().then(function(posts) {
    var s = '';
    for (var i = 0; i < posts.length; i++) {
      var post = posts[i];
      reddicast.queuePost(post.getId());
      s += '<li><a href="javascript:reddicast.queuePost(\'' + post.getId() + '\')">' + post.json['title'] + '</a></li>'
    }
    document.getElementById('r-hot').innerHTML = s;
  });
}