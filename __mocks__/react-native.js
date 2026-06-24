const Platform = {
  OS: 'web',
  select: (obj) => obj.web ?? obj.default,
};

const Alert = {
  alert: () => {},
};

module.exports = { Platform, Alert };
