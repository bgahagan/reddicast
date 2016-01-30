'use strict';

var reddicast = reddicast || {};

reddicast.Media = function() {}
reddicast.Media.prototype.load = function(containerEl) {}
reddicast.Media.prototype.play = function() {}
reddicast.Media.prototype.stop = function() {}
reddicast.Media.prototype.setPaused = function(paused) {}
reddicast.Media.prototype.setVolume = function(volume) {}
reddicast.Media.prototype.getPlayLength = function() {}
reddicast.Media.prototype.getPosition = function() {}
reddicast.Media.prototype.destroy = function() {}

reddicast.ImageMedia = function(url) {
	this.url = url;
  this.playStarted = null;
  this.playLength = 5000;
  this.onStop = util.deferred();
}
reddicast.ImageMedia.prototype.constructor = reddicast.Media;
reddicast.ImageMedia.prototype.destroy = function() {return Promise.resolve();}
reddicast.ImageMedia.prototype.play = function() {
  this.playStarted = Date.now();
  util.promiseAwait(this.playLength).then(this.onStop.resolve);
  return Promise.resolve();
}
reddicast.ImageMedia.prototype.stop = function() {
  this.onStop.resolve();
  return this.waitStop();
}
reddicast.ImageMedia.prototype.waitStop = function() {
  return this.onStop.promise;
}
reddicast.ImageMedia.prototype.setPaused = function(paused) {return Promise.resolve();}
reddicast.ImageMedia.prototype.setVolume = function(volume) {return Promise.resolve();}
reddicast.ImageMedia.prototype.getPlayLength = function() {return Promise.resolve(this.playLength/1000);}
reddicast.ImageMedia.prototype.getPosition = function() {
  return Promise.resolve((Date.now() - this.playStarted) / 1000);
}
reddicast.ImageMedia.prototype.load = function(containerEl) {
	var img = document.createElement('div');
	img.setAttribute('class', 'image-media');
  img.style['background-image'] = "url(" + this.url + ")";
	containerEl.appendChild(img);
  return Promise.resolve();
}

reddicast.YoutubeMedia = function(ytid) {
	this.ytid = ytid;
	this.ytplayer = null;
  this.container = null;
  this.onStop = util.deferred();
}
reddicast.YoutubeMedia.prototype.load = function(containerEl) {
  var frame = document.createElement('div');
  frame.setAttribute('class', 'youtube-media');
  frame.style['background-image'] = "url(http://img.youtube.com/vi/" + this.ytid + "/0.jpg)";
  containerEl.appendChild(frame);
  this.container = frame;
  return Promise.resolve();
}
reddicast.YoutubeMedia.prototype.play = function() {
  var yv = this;
  this.ytplayer = 
    reddicast.loadYoutube()
    .then(function() {
      return new Promise(function (resolve) {
        var onReady = function(e) {
          resolve(e.target);
        }
        var onStateChange = function(e) {
          if (e.data == YT.PlayerState.ENDED)
            yv.onStop.resolve();
        }
        new YT.Player(yv.container, {
          height: '720',
          width: '1280',
          videoId: yv.ytid,
          playerVars: { 'controls': 0, 'rel': 0, 'showinfo': 0, 'autoplay': 1},
          events: {
            'onReady': onReady,
            'onStateChange': onStateChange
          }
        });
      });
    })
  return this.ytplayer
}
reddicast.YoutubeMedia.prototype.stop = function() {
  this.ytplayer.then(function(player) {
    player.stopVideo();
  });
  return this.waitStop();
};

reddicast.YoutubeMedia.prototype.waitStop = function() {return this.onStop.promise;}

reddicast.YoutubeMedia.prototype.setPaused = function(pause) {
	return this.ytplayer.then(function(player) {
		var state = player.getPlayerState();
		if (pause && state === YT.PlayerState.PLAYING) {
			player.pauseVideo();
		} else if (!pause && state === YT.PlayerState.PAUSED) {
			player.playVideo();
		}
	});
}
reddicast.YoutubeMedia.prototype.destroy = function() {
  var that = this;
  return this.ytplayer.then(function(player) {
    player.destroy();
    that.ytplayer = null;
    that.container = null;
  });
}
reddicast.YoutubeMedia.prototype.getPlayLength = function() {
  return this.ytplayer.then(function(player) {
    return player.getDuration();
  });
}
reddicast.YoutubeMedia.prototype.getPosition = function() {
  return this.ytplayer.then(function(player) {
    return player.getCurrentTime();
  });
}

reddicast.EmptySlide = function() {
	this.slideEl = null;
}

reddicast.EmptySlide.prototype.animateOut = function() {
  this.slideEl.setAttribute('class', 'slide slide-offscreen-left');
  return util.promiseAwait(500);
}

reddicast.EmptySlide.prototype.animateIn = function() {
  return Promise.resolve();
}

reddicast.EmptySlide.prototype.load = function(containerEl) {
	var slideEl = this.slideEl = document.createElement('div');
	slideEl.setAttribute('class', 'slide');
	containerEl.appendChild(slideEl);
	return Promise.resolve();
}

reddicast.EmptySlide.prototype.destroy = function(containerEl) {
	this.slideEl.parentNode.removeChild(this.slideEl);
	return Promise.resolve();
}

reddicast.Slide = function(postMedia) {
	this.postMedia = postMedia;
	this.slideEl = null;
}

reddicast.Slide.prototype.moveOffscreen_ = function() {
  console.info("move offscreen slide", this.postMedia);
  this.slideEl.setAttribute('class', 'slide slide-offscreen-left');
  return util.promiseAwait(500);
}

reddicast.Slide.prototype.animateOut = function() {
  console.info("stop slide", this.postMedia);
  return this.postMedia.media.stop()
    .then(this.moveOffscreen_.bind(this));
}

reddicast.Slide.prototype.animateIn = function() {
  console.info("play slide", this.postMedia);
  return this.postMedia.media.play();
}

reddicast.Slide.prototype.load = function(containerEl) {
	console.info("loading slide", this.postMedia);
  
  var slideEl = this.slideEl = document.createElement('div');
	slideEl.setAttribute('class', 'slide');
	containerEl.appendChild(slideEl);
	
  return this.postMedia.media.load(slideEl)
    .then(this.postMedia.post.renderInfo.bind(this.postMedia.post, slideEl));
}

reddicast.Slide.prototype.destroy = function(containerEl) {
  console.info("destroy slide", this.postMedia);
	return this.postMedia.media.destroy()
    .then(this.slideEl.parentNode.removeChild.bind(this.slideEl.parentNode, this.slideEl));
}

reddicast.loadYoutube_
reddicast.loadYoutube = function() {
  if (!reddicast.loadYoutube_) {
    reddicast.loadYoutube_ = new Promise(function(resolve) {
      // Wait for youtube to start
      window['onYouTubeIframeAPIReady'] = resolve

      var tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      var firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    });
  }
  return reddicast.loadYoutube_;
}

/** 
	@constructor
    @struct
*/
reddicast.Player = function() {
	this.playerEl = document.getElementById('player');
	this.slide = null;
  this.queue = [];
  this.messageBus = null;
}

reddicast.Player.prototype.start = function() {
	// Turn on debugging so that you can see what is going on.  Please turn this off
	// on your production receivers.
	cast.receiver.logger.setLevelValue(cast.receiver.LoggerLevel.DEBUG);
	console.log('Starting receiver application');

	
	console.log('Starting receiver manager');
	var castReceiverManager = cast.receiver.CastReceiverManager.getInstance();
	castReceiverManager.onSenderDisconnected = function (event) {
		console.log("Sender disconnected");
		if (window.castReceiverManager.getSenders().length == 0 &&
			event.reason == cast.receiver.system.DisconnectReason.REQUESTED_BY_SENDER) {
		  window.close();
		}
	};
	
	var messageBus = this.messageBus = castReceiverManager.getCastMessageBus('urn:x-cast:reddicast', cast.receiver.CastMessageBus.MessageType.JSON);
	var player = this;
	
	// handler for the CastMessageBus message event
	messageBus.onMessage = function(event) {
		console.log('Message [' + event.senderId + ']: ' + event.data);
		var action = event.data.action
	  if (action === 'queue') {
      player.queuePost(event.data.postId)
    } else if (action === 'next') {
      player.next();
    }
    
		// inform all senders on the CastMessageBus of the incoming message event
		// sender message listener will be invoked
		messageBus.send(event.senderId, event.data);
	}
	
	var appConfig = new cast.receiver.CastReceiverManager.Config();
	appConfig.statusText = 'Ready to play';
	appConfig.maxInactivity = 6000;
  castReceiverManager.start(appConfig);
}

reddicast.Player.prototype.broadcast = function(message) {
  if (this.messageBus) {
    this.messageBus.broadcast(message);
  }
}

reddicast.Player.prototype.showPostMedia = function(postMedia) {
  if (!this.slide) {
    // init case
    this.slide = new reddicast.EmptySlide();
    this.slide.load(this.playerEl);
  }
  var prevSlide = this.slide;
  var newSlide = this.slide = postMedia ? new reddicast.Slide(postMedia) : new reddicast.EmptySlide();
  var newPostId = newSlide.postMedia ? newSlide.postMedia.post.getId() : -1;
  var player = this;
  // load new slide
	return newSlide.load(this.playerEl)
    // animate out previous slide
    .then(prevSlide.animateOut.bind(prevSlide))
    // TODO .then(this.broadcast.bind(this, {'status': 'playing', 'postId': newPostId}))
    // play the new slide
    .then(newSlide.animateIn.bind(newSlide))
    // destroy the old slide
    .then(prevSlide.destroy.bind(prevSlide))
    // Wait for new slide to complete
    .then(function() {
      if (newSlide.postMedia) {
        return newSlide.postMedia.media.waitStop()
          // Advance to next slide
          .then(function() {
            if (player.slide === newSlide) player.next();
          });
      }
    })
    
}

reddicast.parseImagurUrl = function(domain, url) {
	if (url.indexOf('imgur.com') > 0) {

		if (url.indexOf('gifv') >= 0) {
			if (url.indexOf('i.') === 0) {
				url = url.replace('imgur.com', 'i.imgur.com');
			}
			return url.replace('.gifv', '.gif');
		}

		if (url.indexOf('/a/') > 0 || url.indexOf('/gallery/') > 0) {
			// albums aren't supported yet
			//console.log('Unsupported gallery: ' + url);
			return null;
		}
		
		// imgur is really nice and serves the image with whatever extension
		// you give it. '.jpg' is arbitrary
		// regexp removes /r/<sub>/ prefix if it exists
		// E.g. http://imgur.com/r/aww/x9q6yW9
		return url.replace(/r\/[^ \/]+\/(\w+)/, '$1') + '.jpg';
	}
	return null;
}

reddicast.extractImageMedia = function(urlParser, domain, url) {
  url = urlParser(domain, url)
  if (url)
    return new reddicast.ImageMedia(url)
  return null;
}

reddicast.extractYoutubeMedia = function(domain, url) {
  var hashRe = /^https?:\/\/(?:www\.|m\.)?youtube\.com\/watch.*?[?&]v=([\w\-]+)/i;
	var altHashRe = /^https?:\/\/(?:www\.)?youtu\.be\/([\w\-]+)/i;

  var groups = hashRe.exec(url);
  if (!groups) groups = altHashRe.exec(url);

  if (groups) {

    // Check url for timecode e.g t=1h23m15s
    var timecodeRe = /t=(.*?)(?:$|&)/i;
    var starttime = 0, timecodeResult = timecodeRe.exec(url);

    if (timecodeResult !== null) {
      var time_blocks = {'h':3600, 'm':60, 's':1},
        timeRE = /[0-9]+[hms]/ig;

      // Get each segment e.g. 8m and calculate its value in seconds
      var timeMatch = timecodeResult[0].match(timeRE);
      if (timeMatch) {
        timeMatch.forEach(function(ts){
          var unit = time_blocks[ts.charAt(ts.length-1)];
          var amount = parseInt(ts.slice(0, -1), 10);
          // Add each unit to starttime
          starttime += unit * amount;
        });
      } else {
        // support direct timestamp e.g. t=200
        starttime = parseInt(timecodeResult[0].replace('t=', ''), 10);
        if (isNaN(starttime)) starttime = 0;
      }
    }
    return new reddicast.YoutubeMedia(groups[1], starttime);
  }
  return null;
}

reddicast.mediaExtractors = [reddicast.extractYoutubeMedia, reddicast.extractImageMedia.bind(null, reddicast.parseImagurUrl)]

reddicast.Player.prototype.fetchPostMedia = function(post) {
	var url = post.getUrl();
  var domain = post.getDomain();
	console.info("Parsing post url", domain, url);
  
  var extractors = reddicast.mediaExtractors.slice(0);
  
	var media = null;
  var extractor = null;
  while (!media && (extractor = extractors.shift())) {
    media = extractor(domain, url);
  }
  if (media)
    return Promise.resolve(new reddicast.PostMedia(post, media))
  else
    return Promise.reject(new Error('Unable to determine media type for ' + url));
}

reddicast.Player.prototype.queuePost = function(id) {
  this.queue.push(id);
  if (!this.slide || !this.slide.postMedia) {
    this.next();
  }
}

reddicast.Player.prototype.next = function() {
  var nextId = this.queue.shift();
  if (nextId)
    this.fetchAndShowPost(nextId);
  else
    this.showPostMedia(null);
}

reddicast.Player.prototype.fetchAndShowPost = function(id) {
	return reddicast.Post.fetch(id)
		.then(this.fetchPostMedia.bind(this))
		.then(this.showPostMedia.bind(this))
}

reddicast.PostMedia = function(post, media) {
	this.post = post;
	this.media = media;
}

reddicast.Player.prototype.getMedia = function() {
	return this.media;
}

reddicast.loadYoutube();

window.onload = function() {
  window.player = new reddicast.Player();
	window.player.start();
  window.player.next(); // init the empty slide
}
