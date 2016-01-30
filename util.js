'use strict';

var util = util || {};

util.promisify = function(f) {
  return new Promise(function(onSuccess, onError) {
    f(onSuccess, onError);
  });
}

util.promiseAwait = function(ms) {
  return new Promise(function(onSuccess) {
    window.setTimeout(onSuccess, ms)
  });
}

util.deferred = function() {
  var deferred = {};
  
  deferred.state = 'pending';

  deferred.promise = new Promise(function(resolve, reject) {
    deferred.resolve = function() {
      deferred.state = 'resolved';
      resolve.apply(null, arguments);
    }
    deferred.reject = function() {
      deferred.state = 'rejected';
      reject.apply(null, arguments);
    }
  });

  return deferred;
}

var reddicast = reddicast || {};

reddicast.firstListingResult = function (json) {
	console.info("Got reddit response", json);
	return json['data']['children'][0];
}

reddicast.responseToJson = function(response) { return response.json() }

reddicast.Post = function(json) {
	this.json = json;
}

reddicast.Post.prototype.getUrl = function() {
	return this.json['url'];
}

reddicast.Post.prototype.getId = function() {
	return this.json['id'];
}

reddicast.Post.prototype.getDomain = function() {
	return this.json['domain'];
}

reddicast.Post.prototype.renderInfo = function(containerEl) {
	var info = document.createElement('div');
	info.setAttribute('class', 'media-info');
	var title = this.json['title'];
	var comments = this.json['num_comments'];
	var score = this.json['score'];
	var author = '/u/' + this.json['author'];
	var sub = '/r/' + this.json['subreddit'];
	info.innerHTML = '<h2 class="title">' + title + '</h2><h3>' + score + ' by ' + author + ' on ' + sub + ' ' + comments + ' comments </h3>';
	containerEl.appendChild(info);
}

reddicast.Post.fromJson = function (json) {
  if (json['kind'] !== 't3') throw new Error("Unexpected type" + json['kind']);
  return new reddicast.Post(json['data']);
}

reddicast.Post.fetch = function (id) {
	return fetch(
			'https://www.reddit.com/r/pics/api/info.json?id=t3_' + id,
			{mode: 'cors'}
		).then(reddicast.responseToJson)
		 .then(reddicast.firstListingResult)
     .then(reddicast.Post.fromJson);
}

reddicast.SubReddit = function(name) {
  this.name = name;
}

reddicast.SubReddit.prototype.hot = function() {
  return fetch('https://www.reddit.com/r/' + this.name + '/hot.json', {mode: 'cors'})
    .then(reddicast.responseToJson)
    .then(function(result) {
      return result['data']['children'].map(reddicast.Post.fromJson)
    })
}

