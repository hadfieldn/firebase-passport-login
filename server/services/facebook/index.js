exports.setup = function(passport, config) {
  var FacebookStrategy = require('passport-facebook').Strategy;

  passport.use(new FacebookStrategy({
<<<<<<< HEAD
      clientID: config.FACEBOOK_APP_ID,
      clientSecret: config.FACEBOOK_APP_SECRET,
      callbackURL: config.FACEBOOK_CALLBACK_URL
=======
      clientID: config.clientID,
      clientSecret: config.clientSecret,
      callbackURL: config.callbackURL
>>>>>>> origin/upstream-1.0-fixes
    },
    function(accessToken, refreshToken, profile, done) {
      var user = {
        refreshToken: refreshToken || "",
        accessToken: accessToken,
        provider: profile.provider,
        id: profile.id,
        uid: profile.provider + ':' + profile.id,
        displayName: profile.name,
<<<<<<< HEAD
        thirdPartyUserData: profile._json  
      };
      return done(0, user);
=======
      };
      return done(0, {user: user, thirdPartyUserData: profile._json});
>>>>>>> origin/upstream-1.0-fixes
    }
  ));

  return {
<<<<<<< HEAD
    options: {
      scope: 'read_stream'      
    }
=======
    options: config.options || {}
>>>>>>> origin/upstream-1.0-fixes
  };
};
