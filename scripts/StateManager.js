// Manages the current state of the extension, views can register to it
// and it will notify certain events.

'use strict';

function StateManager() {

	var self = this;

	var options = {};
	var callbacks = {};

	var timeKeeper = new TimeKeeper();
	var weatherManager;
	var isKKTime;

	this.registerCallback = function (event, callback) {
		callbacks[event] = callbacks[event] || [];
		callbacks[event].push(callback);
	};

	this.getOption = function (option) {
		return options[option];
	};

	this.activate = function () {
		isKKTime = timeKeeper.getDay() == 6 && timeKeeper.getHour() >= 20;
		getSyncedOptions(function () {
			if (!weatherManager) {
				weatherManager = new WeatherManager(options.zipCode, options.countryCode);
				weatherManager.registerChangeCallback(function () {
					if (!isKK() && isLive()) {
						notifyListeners("gameChange", [timeKeeper.getHour(), getGame(), getWeather()]);
						notifyListeners("weatherChange", [timeKeeper.getHour(), getGame(), getWeather()]);
					}
				});
			}

			notifyListeners("volume", [options.volume]);
			if (isKK()) {
				notifyListeners("kkStart");
			} else {
				notifyListeners("hourMusic", [timeKeeper.getHour(), getGame(), getWeather(), false]);
			}
		});
	};

	// Possible events include:
	// volume, kkStart, hourMusic, gameChange, weatherChange, pause
	function notifyListeners(event, args) {
		if (!options.paused || event === "pause") {
			var callbackArr = callbacks[event] || [];
			for (var i = 0; i < callbackArr.length; i++) {
				callbackArr[i].apply(window, args);
			}
			printDebug("Notified listeners of " + event + " with args: " + args);
		}
	}

	function isKK() {
		return options.alwaysKK || (options.enableKK && isKKTime);
	}

	function isLive() {
		return options.weather == 'live';
	}

	// retrieve saved options
	function getSyncedOptions(callback) {
		chrome.storage.sync.get({
			volume: 0.5,
			game: 'new-leaf',
			weather: 'normal',
			enableNotifications: true,
			enableKK: true,
			alwaysKK: false,
			paused: false,
			enableTownTune: true,
			//enableAutoPause: false,
			zipCode: "98052",
			countryCode: "us",
			enableBadgeText: true
		}, function (items) {
			options = items;
			if (typeof callback === 'function') {
				callback();
			}
		});
	}

	// Gets the current game based on the option
	function getGame() {
		if (options.game === "random") {
			let games = [
				'animal-crossing',
				'city-folk',
				'new-leaf',
			];
			return games[Math.floor(Math.random() * games.length)];
		} else
			return options.game;
	}

	// Gets the current weather based on the option,
	//  or from the API if we're using live weather.
	function getWeather() {
		if (options.weather === "live") {
			return weatherManager.getWeather().toLowerCase();
		}

		return options.weather;
	}


	// If we're not playing KK, let listeners know the hour has changed
	// If we enter KK time, let listeners know
	timeKeeper.registerHourlyCallback(function (day, hour) {
		var wasKK = isKK();
		isKKTime = day == 6 && hour >= 20;
		if (isKK() && !wasKK) {
			notifyListeners("kkStart");
		} else if (!isKK()) {
			notifyListeners("hourMusic", [hour, getGame(), getWeather(), true]);
		}
	});

	// Update our options object if stored options changes, and notify listeners
	// of any pertinent changes.
	chrome.storage.onChanged.addListener(function (changes, namespace) {
		var wasKK = isKK();
		var oldGame = getGame();
		var oldWeather = getWeather();

		getSyncedOptions(function () {
			if (typeof changes.zipCode !== 'undefined') {
				weatherManager.setZip(options.zipCode);
			}
			if (typeof changes.countryCode !== 'undefined') {
				weatherManager.setCountry(options.countryCode);
			}
			if (typeof changes.volume !== 'undefined') {
				notifyListeners("volume", [options.volume]);
			}
			if (typeof changes.game !== 'undefined' && !isKK() && getGame() != oldGame) {
				notifyListeners("gameChange", [timeKeeper.getHour(), getGame(), getWeather()]);
			}
			if (typeof changes.weather !== 'undefined' && !isKK() && getWeather() != oldWeather) {
				notifyListeners("weatherChange", [timeKeeper.getHour(), getGame(), getWeather()]);
			}
			if (isKK() && !wasKK) {
				notifyListeners("kkStart");
			}
			if (!isKK() && wasKK) {
				notifyListeners("hourMusic", [timeKeeper.getHour(), getGame(), getWeather(), false]);
			}
		});
	});

	// play/pause when user clicks the extension icon
	chrome.browserAction.onClicked.addListener(function () {
		chrome.storage.sync.set({
			paused: !options.paused
		}, function () {
			getSyncedOptions(function () {
				if (options.paused) {
					notifyListeners("pause");
				} else {
					self.activate();
				}
			});
		});
	});

	// Gives easy access to the notifyListeners function if
	// we're debugging.
	if (DEBUG_FLAG) {
		window.notify = notifyListeners;
		window.setTime = function (hour, playTownTune) {
			notifyListeners("hourMusic", [hour, options.game, options.weather, playTownTune]);
		};
	}

}