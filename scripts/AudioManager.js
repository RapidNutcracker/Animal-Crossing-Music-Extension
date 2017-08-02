// Handles playing hourly music, KK, and the town tune.

'use strict';

function AudioManager(addEventListener, isTownTune) {

	var audio = document.createElement('audio');
	var killLoopTimeout;
	var killFadeInterval;
	var townTuneManager = new TownTuneManager();

	// isHourChange is true if it's an actual hour change,
	// false if we're activating music in the middle of an hour
	function playHourlyMusic(hour, game, weather, isHourChange) {
		clearLoop();
		audio.loop = true;
		audio.removeEventListener("ended", playKKSong);
		var fadeOutLength = isHourChange ? 3000 : 500;
		fadeOutAudio(fadeOutLength, function() {
			if (isHourChange && isTownTune()) {
				townTuneManager.playTune(function() {
					playHourSong(game, hour, weather, false);
				});
			} else {
				playHourSong(game, hour, weather, false);
			}
		});
	}

	// Plays a song for an hour, setting up loop times if
	// any exist
	function playHourSong(game, hour, weather, skipIntro) {
		audio.loop = true;
		audio.src = '../audio/' + game + '/' + weather + '/' + formatHour(hour) + 'm.ogg';
		var loopTime = (loopTimes[game] || {})[hour];
		// set up loop points if loopTime is set up for this
		// game and hour
		if(loopTime) {
			var delayToLoop = loopTime.end;
			if(skipIntro) {
				audio.currentTime = loopTime.start;
				delayToLoop -= loopTime.start;
			}
			audio.onplay = function() {
				var loopTimeout = setTimeout(function() {
					printDebug("looping");
					playHourSong(game, hour, true);
				}, delayToLoop * 1000);
				killLoopTimeout = function() {
					clearTimeout(loopTimeout);
					audio.onplay = function() {};
					loopTimeout = null;
				};
			}
		}
		audio.play();
	}

	function playKKMusic() {
		clearLoop();
		audio.loop = false;
		audio.addEventListener("ended", playKKSong);
		fadeOutAudio(500, playKKSong);
	}

	function playKKSong(type) {
		var randomSong = Math.floor((Math.random() * 75) + 1);
		audio.src = '../kk/' + type + '/' + randomSong + '.ogg';
		audio.play();
	}

	// clears the loop point timeout and the fadeout
	// interval if one exists
	function clearLoop() {
		if(typeof(killLoopTimeout) === 'function') {
			killLoopTimeout();
		}
		if(typeof(killFadeInterval) === 'function') {
			killFadeInterval();
		}
	}

	// Fade out audio and call callback when finished.
	function fadeOutAudio(time, callback) {
		if (audio.paused) {
			if (callback) callback();
		} else {
			var oldVolume = audio.volume;
			var step = audio.volume / (time / 100.0);
			var fadeInterval = setInterval(function() {
				if (audio.volume > step) {
					audio.volume -= step;
				} else {
					clearInterval(fadeInterval);
					audio.pause();
					audio.volume = oldVolume;
					if (callback) callback();
				}
			}, 100);
			killFadeInterval = function() {
				clearInterval(fadeInterval);
				audio.volume = oldVolume;
				killFadeInterval = null;
			}
		}
	}

	addEventListener("hourMusic", playHourlyMusic);

	addEventListener("kkStart", playKKMusic);

	addEventListener("gameChange", playHourlyMusic);

	addEventListener("weatherChange", playHourlyMusic);

	addEventListener("pause", function() {
		clearLoop();
		fadeOutAudio(300);
	});

	addEventListener("volume", function(newVol) {
		audio.volume = newVol;
	});

}
