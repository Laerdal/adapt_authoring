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
  var idleTimeLimit = (Origin.constants.maxAge ?  Origin.constants.maxAge : 3600000); // 1 hrs of inactivity before logout or 1 hour by default - if maxAge is not defined.

  // Function to handle user activity and reset inactivity timer
  function resetInactivityTimer() {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }
    inactivityTimer = setTimeout(logoutUser, idleTimeLimit); // Log out after 1 hour of inactivity
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

  // Helper function to check if we should redirect to external authentication
  function shouldUseExternalAuth() {
    var emailAuthBypassEnabled = Origin.constants && Origin.constants.emailAuthBypassEnabled;
    var externalAuthUrl = Origin.constants && Origin.constants.externalAuthUrl;
    
    // Only use external auth if bypass is enabled AND external URL is configured
    return emailAuthBypassEnabled === true && 
           externalAuthUrl !== undefined && 
           externalAuthUrl !== null && 
           externalAuthUrl.trim() !== '';
  }

  // Helper function to redirect to external authentication
  function redirectToExternalAuth() {
    var externalAuthUrl = Origin.constants && Origin.constants.externalAuthUrl;
    if (externalAuthUrl) {
      // Logout the session before redirecting to avoid conflicts
      Origin.sessionModel.logout();
      window.location.href = externalAuthUrl;
    }
  }

  // Helper function to check if user is Super Admin
  function isSuperAdmin() {
    if (!Origin.sessionModel) {
      return false;
    }
    
    // Check by permissions - Super Admin has full permissions on all resources
    var permissions = Origin.sessionModel.get('permissions');
    if (permissions && permissions.length > 0) {
      var hasSuperAdminPermission = permissions.some(function(perm) {
        // Check if permission is a string or object
        if (typeof perm === 'string') {
          return perm === 'urn:x-adapt:*/*' || perm.indexOf('*/*') !== -1;
        } else if (perm && perm.resource) {
          return perm.resource === 'urn:x-adapt:*/*' || perm.resource.indexOf('*/*') !== -1;
        }
        return false;
      });
      
      if (hasSuperAdminPermission) {
        return true;
      }
    }
    
    // Not a Super Admin
    return false;
  }

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

    // Check if user management bypass is enabled
    var userManagementBypassEnabled = Origin.constants && Origin.constants.userManagementBypassEnabled;

    switch (location) {
      case 'login':
        // Redirect to external auth if configured
        if (shouldUseExternalAuth()) {
          redirectToExternalAuth();
          return;
        }
        Origin.trigger('location:title:hide');
        currentView = LoginView;
        break;
      case 'logout':
        // Redirect to external auth if configured (logout handled in redirectToExternalAuth)
        if (shouldUseExternalAuth()) {
          redirectToExternalAuth();
          return;
        }
        // Normal logout flow
        Origin.sessionModel.logout();
        break;
      case 'forgot':
        // Redirect to external auth if configured (password management handled externally)
        if (shouldUseExternalAuth()) {
          redirectToExternalAuth();
          return;
        }
        Origin.trigger('sidebar:sidebarContainer:hide');
        currentView = ForgotPasswordView;
        break;
      case 'reset':
        // Redirect to external auth if configured (password management handled externally)
        if (shouldUseExternalAuth()) {
          redirectToExternalAuth();
          return;
        }
        Origin.trigger('sidebar:sidebarContainer:hide');
        currentView = ResetPasswordView;
        break;
      case 'profile':
        // If userManagementBypassEnabled is true, redirect to external auth
        if (userManagementBypassEnabled === true) {
          redirectToExternalAuth();
          return;
        }
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
