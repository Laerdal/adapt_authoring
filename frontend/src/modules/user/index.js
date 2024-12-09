// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
define(function(require) {

  var Origin = require('core/origin');
  var LoginView = require('./views/loginView');
  var UserProfileView = require('./views/userProfileView');
  var UserProfileSidebarView = require('./views/userProfileSidebarView');
  var UserProfileModel = require('./models/userProfileModel');
  
  var ForgotPasswordView = require('./views/forgotPasswordView');
  var ResetPasswordView = require('./views/resetPasswordView');
  var UserPasswordResetModel = require('./models/userPasswordResetModel');

  var inactivityTimer;
  var idleTimeLimit = (Origin.constants.maxAge ?  Origin.constants.maxAge : 3600000); // 1 hrs of inactivity before logout or 1 day if maxAge is not defined.

  // Function to handle user activity and reset inactivity timer
  function resetInactivityTimer() {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }
    inactivityTimer = setTimeout(logoutUser, idleTimeLimit); // Log out after 10 seconds of inactivity
  }

  // Function to log out the user
  function logoutUser() {
    console.log("User logged out due to inactivity");
    Origin.Notify.alert({
      type: 'error',
      text: Origin.l10n.t('app.errorsessionexpired')
    });  
    Origin.sessionModel.logout();
  }

  // Listen for various user interactions to reset the inactivity timer
  document.addEventListener('mousemove', resetInactivityTimer);
  document.addEventListener('mousedown', resetInactivityTimer);
  document.addEventListener('scroll', resetInactivityTimer);

  window.addEventListener('scroll', resetInactivityTimer);
  document.addEventListener('keydown', resetInactivityTimer);
  window.addEventListener('resize', resetInactivityTimer);
  
  window.addEventListener('click', resetInactivityTimer);
  document.addEventListener('click', resetInactivityTimer);
  
  document.addEventListener('touchstart', resetInactivityTimer);
  document.addEventListener('pointerdown', resetInactivityTimer);
   
  document.addEventListener('focus', resetInactivityTimer, true); // Capture the event on the document level
  document.addEventListener('visibilitychange', resetInactivityTimer);

  // Initializing the inactivity timer when the module loads
  resetInactivityTimer();

  // Handling navigation actions
  Origin.on('navigation:user:logout', function() {
    Origin.router.navigateTo('user/logout');
  });

  Origin.on('navigation:user:profile', function() {
    Origin.router.navigateTo('user/profile');
  });

  Origin.on('router:user', function(location, subLocation, action) {
    var currentView;
    var settings = {};

    settings.authenticate = false;

    switch (location) {
      case 'login':
        Origin.trigger('location:title:hide');
        currentView = LoginView;
        break;
      case 'logout':
        Origin.sessionModel.logout();
        break;
      case 'forgot':
        Origin.trigger('sidebar:sidebarContainer:hide');
        currentView = ForgotPasswordView;
        break;
      case 'reset':
        Origin.trigger('sidebar:sidebarContainer:hide');
        currentView = ResetPasswordView;
        break;
      case 'profile':
        settings.authenticate = true;
        Origin.trigger('location:title:update', {title: Origin.l10n.t('app.editprofiletitle')});
        currentView = UserProfileView;
        break;
    }
    
    if (currentView) {
      switch (location) {
        case 'profile':
          var profile = new UserProfileModel();
          profile.fetch({
            success: function() {
              Origin.sidebar.addView(new UserProfileSidebarView().$el);
              Origin.contentPane.setView(currentView, { model: profile });
            }
          });
          break;
        case 'reset':
          var reset = new UserPasswordResetModel({token: subLocation});
          reset.fetch({
            success: function() {
              Origin.contentPane.setView(currentView, { model: reset });
            }
          });
          break;
        default:
          Origin.contentPane.setView(currentView, { model: Origin.sessionModel });
      }
    }
  });

})
