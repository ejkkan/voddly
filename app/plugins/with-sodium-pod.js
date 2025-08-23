// No-op: sodium pod no longer required since we use libsodium-wrappers.
module.exports = function withSodiumPod(config) {
  return config;
};
