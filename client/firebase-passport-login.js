// Copyright (c) 2013 Abraham Haskins, https://github.com/abeisgreat https://github.com/rigidflame/firebase-passport-login
var FirebasePassportLogin = (function (firebaseURL, oAuthServerURL, callback) {
    /* globals Firebase */
    var self = this;
    self._ref = new Firebase(firebaseURL);
    self._tokenPath = "oAuth/login";
    self._oAuthServerURL = oAuthServerURL;
    self._oAuthServerWindow = {width:1024, height:650};
    self._callback = callback;
    self._ready = true;
    self._redirectURL = null;
    self._firebaseURL = firebaseURL;
    self._removeTokensImmediately = true;       // Change to false to persist user data at /oAuth/users/$token


    self._popupCenter = function (url, title, w, h) {
        // from http://stackoverflow.com/questions/4068373/center-a-popup-window-on-screen
        // Fixes dual-screen position                         Most browsers      Firefox
        var dualScreenLeft = window.screenLeft != undefined ? window.screenLeft : screen.left;
        var dualScreenTop = window.screenTop != undefined ? window.screenTop : screen.top;

        width = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width;
        height = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height;

        var left = ((width / 2) - (w / 2)) + dualScreenLeft;
        var top = ((height / 2) - (h / 2)) + dualScreenTop;
        var newWindow = window.open(url, title, 'scrollbars=yes, width=' + w + ', height=' + h + ', top=' + top + ', left=' + left);

        // Puts focus on the newWindow
        if (window.focus) {
            newWindow.focus();
        }

        return newWindow;
    };

    /**
     * Set up Firebase listener on the anonymous user. When the anonymous user has been
     * authenticated through Passport, invoke @link{ _handleOAuthLogin } with the auth token
     * obtained through Passport.
     * @private
     */
    self._initializePassportLogin = function (oAuthTokenPath) {
        var oAuthTokenRef = self._ref.child(oAuthTokenPath);

        cookie.set('passportAnonymous', self._anonymousUid, {secure: document.location.href.indexOf("https") === 0});
        oAuthTokenRef.on("value", function (snapshot) {
            var token = snapshot.val();
            //('value changed for auth token: ' + token);
            if (token) {
                cookie.remove('passportAnonymous');
                oAuthTokenRef.remove();
                oAuthTokenRef.off();
                try {
                    self._oAuthWindow.close();
                }
                catch (err) {
                    console.error(err);
                }
                self._ref.unauth();

                self._setToken(token);
            }
        });


    };

    /**
     * Authenticate to Firebase with the custom token obtained through OAuth and store it as a
     * `passportSession` cookie. Then call the user-provided callback method with the user object.
     *
     * @param token - Passport session token
     * @private
     */
    self._setToken = function (token) {
        if (!token) return;
        self._ref.authWithCustomToken(token, function (error, data) {
            if (error) {
                if (error.code == "EXPIRED_TOKEN") {
                    cookie.set("passportSession", "");
                }
                self._callback(error);
            } else {
                var oAuthUserRef = self._ref.child('oAuth/users').child(token.replace(/\./g, ''));
                oAuthUserRef.once("value", function (snap) {
                    var user = snap.val();
                    if (!user) return;
                    user[user.provider] = {cachedUserProfile: JSON.parse(user.thirdPartyUserData)};
                    user.token = token;
                    user.thirdPartyUserData = undefined;
                    if (self._removeTokensImmediately) {
                        oAuthUserRef.remove();
                        cookie.set("passportSession", "");
                    }
                    else {
                        cookie.set("passportSession", token);
                    }
                    self._callback(null, user);
                });
            }
        });
    };

    self._log = function (message) {
        if (console.log) {
            console.log("FirebasePassportLogin: " + message);
        }
    };

    self._oAuthTokenPath = function() {
        return [
            self._tokenPath,
            self._anonymousUid
        ].join('/');
    };

    /**
     * Log in to Firebase through the indicated authentication provider.
     *
     * First creates an anonymous authentication with Firebase, passing the anonymous auth
     * token on to the server along with a Firebase key to set with authenticated user data.
     * We then listen for the authenticated user data to be set, calling the user-provided
     * `callback` function when it is.
     *
     * The authenticated user token is stored in a cookie (`passportCookie`) to enable
     * automatic authentication later.
     *
     * @param {String} provider - Provider to authenticate through ('facebook', 'reddit', etc.)
     */
    self.login = function (provider) {

        // Have to open the authentication window immediately in order to avoid popup blockers

        self._provider = provider;
        if (! self._anonymousUid) {
            // _getAnonymousUid() should have been called automatically when the page loaded.
            self._log("Anonymous login failed. Make sure Anonymous login is enabled in your Firebase");
        }
        else {
            var oAuthTokenPath = self._oAuthTokenPath();
            var oAuthWindowURL = self._oAuthServerURL + self._provider
              + "?oAuthTokenPath=" + oAuthTokenPath
              + "&redirect=" + encodeURIComponent(self._redirectURL);
            if (self._firebaseURL) {
                oAuthWindowURL += "&firebaseURL=" + encodeURIComponent(self._firebaseURL);
            }
            self._oAuthWindow = self._popupCenter(oAuthWindowURL, "_blank",
              self._oAuthServerWindow.width,
              self._oAuthServerWindow.height);

            self._initializePassportLogin(oAuthTokenPath);
        }
    };

    self._getAnonymousUid = function () {
        if (self._ref.getAuth()) {
            self._ref.unauth();
        }
        self._ref.authAnonymously(function (err, authData) {
            if (err) {
                self._log("Anonymous login failed. Make sure Anonymous login is enabled in your Firebase");
            } else {
                var user = authData.auth;
                if (user) {
                    self._anonymousUid = user.uid;
                }
            }

        }, {remember: 'default'});   // remember: 'none', 'sessionOnly', 'default'
    };

    /**
     * Disconnect from Firebase and clear the passportSession cookie.
     */
    self.logout = function () {
        var token = cookie.get("passportSession");
        if (token) {
            self._ref.child('oAuthUsers').child(token.replace(/\./g, '')).remove();
        }
        self._ref.unauth();
        cookie.set("passportSession", "");
        self._callback(null, null);
    };


    /**
     * To re-establish an anonymous connection to the database prior to calling login,
     * use
     *
     *   document.getElementById('login-iframe').contentWindow.postMessage(JSON.stringify({redirect:<url>}), '*' );
     *
     * where 'login-iframe' is the id of the iframe containing the login popup window.
     *
     */
    self._messageHandler = function (event) {
      try {
        var action = JSON.parse(event.data);
        self._getAnonymousUid();
        if (action.redirect) {
          self._redirectURL = action.redirect;
        }
      } catch (err) {
        // couldn't parse the event data -- must have been a message not intended for us
        //console.log({err:err, 'event.data': event.data, status: 'Error handling event'}, '_messageHandler');
      }
    };

    /**
     * Initialization occurs automatically with the setTimeout() call below,
     * so it should not be necessary to call this method.
     */
    self.init = function () {

        // Set up the message listener so that the calling window can create the
        // anonymous Firebase connection whenever the login window is opened as a dialog,
        // without reloading the page. Instead of attempting to authenticate automatically 
        // with the passportSession whne the page is first loaded (by calling self._setToken(), 
        // we allow Firebase to authenticate with the custom token that it stored from the 
        // last successful authentication.

        // We don't create an anonymous connection until the postMessage event
        // so that we don't change what may be a valid Firebase session token into
        // an anonymous session token.

        var storedAnonymousUid = cookie.get('passportAnonymous');
        if (storedAnonymousUid) {
            var authData = self._ref.getAuth();
            if (authData && authData.uid === storedAnonymousUid) {
                self._anonymousUid = storedAnonymousUid;
                self._initializePassportLogin(self._oAuthTokenPath());
            }
            else {
                cookie.set('passportAnonymous', '');
            }
        }
        //alert('passportSession = ' + cookie.get('passportSession'));
        window.addEventListener('message', self._messageHandler);
    };

    /**
     * Attempt to authenticate automatically with the passportSession cookie.
     */
    setTimeout(function () {
        self.init();
    });

    // Copyright (c) 2012 Florian H., https://github.com/js-coder https://github.com/js-coder/cookie.js
    !function(e,t){var n=function(){return n.get.apply(n,arguments)},r=n.utils={isArray:Array.isArray||function(e){return Object.prototype.toString.call(e)==="[object Array]"},isPlainObject:function(e){return!!e&&Object.prototype.toString.call(e)==="[object Object]"},toArray:function(e){return Array.prototype.slice.call(e)},getKeys:Object.keys||function(e){var t=[],n="";for(n in e)e.hasOwnProperty(n)&&t.push(n);return t},escape:function(e){return String(e).replace(/[,;"\\=\s%]/g,function(e){return encodeURIComponent(e)})},retrieve:function(e,t){return e==null?t:e}};n.defaults={},n.expiresMultiplier=86400,n.set=function(n,i,s){if(r.isPlainObject(n))for(var o in n)n.hasOwnProperty(o)&&this.set(o,n[o],i);else{s=r.isPlainObject(s)?s:{expires:s};var u=s.expires!==t?s.expires:this.defaults.expires||"",a=typeof u;a==="string"&&u!==""?u=new Date(u):a==="number"&&(u=new Date(+(new Date)+1e3*this.expiresMultiplier*u)),u!==""&&"toGMTString"in u&&(u=";expires="+u.toGMTString());var f=s.path||this.defaults.path;f=f?";path="+f:"";var l=s.domain||this.defaults.domain;l=l?";domain="+l:"";var c=s.secure||this.defaults.secure?";secure":"";e.cookie=r.escape(n)+"="+r.escape(i)+u+f+l+c}return this},n.remove=function(e){e=r.isArray(e)?e:r.toArray(arguments);for(var t=0,n=e.length;t<n;t++)this.set(e[t],"",-1);return this},n.empty=function(){return this.remove(r.getKeys(this.all()))},n.get=function(e,n){n=n||t;var i=this.all();if(r.isArray(e)){var s={};for(var o=0,u=e.length;o<u;o++){var a=e[o];s[a]=r.retrieve(i[a],n)}return s}return r.retrieve(i[e],n)},n.all=function(){if(e.cookie==="")return{};var t=e.cookie.split("; "),n={};for(var r=0,i=t.length;r<i;r++){var s=t[r].split("=");n[decodeURIComponent(s[0])]=decodeURIComponent(s[1])}return n},n.enabled=function(){if(navigator.cookieEnabled)return!0;var e=n.set("_","_").get("_")==="_";return n.remove("_"),e},typeof define=="function"&&define.amd?define(function(){return n}):typeof exports!="undefined"?exports.cookie=n:window.cookie=n}(document);
    //
});
