function getPermissionsAsync() { return Promise.resolve({ status: 'granted' }); }
function requestPermissionsAsync() { return Promise.resolve({ status: 'granted' }); }
function setNotificationChannelAsync(channelId, options) { return Promise.resolve(); }
function getExpoPushTokenAsync() { return Promise.resolve({ data: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' }); }
function setNotificationHandler(handler) {}

module.exports = {
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationChannelAsync,
  getExpoPushTokenAsync,
  setNotificationHandler,
  AndroidImportance: { MAX: 5, DEFAULT: 3 },
};
