define(function(require) {
  var Origin = require('core/origin');
  var UserManagementView = require('./views/userManagementView');
  var UserManagementSidebarView = require('./views/userManagementSidebarView');
  var AddUserView = require('./views/addUserView');
  var AddUserSidebarView = require('./views/addUserSidebarView');
  var CustomHelpers = require('./helpers');
  var UserCollection = require('./collections/userCollection');

  var isReady = false;
  var data = {
    featurePermissions: ["*/*:create","*/*:read","*/*:update","*/*:delete"],
    allRoles: new Backbone.Collection(),
    allTenants: new Backbone.Collection(),
    userManagementBypassEnabled: false
  };

  // Helper function to check if user is Super Admin
  var isSuperAdmin = function() {
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
  };

  Origin.on('origin:dataReady login:changed', function() {
    Origin.permissions.addRoute('userManagement', data.featurePermissions);

    // Only add the global menu item if userManagementBypassEnabled is not true
    // AND if the user has the required permissions
  	if (Origin.permissions.hasPermissions(data.featurePermissions)) {
          data.allRoles.on('sync', onDataFetched);
    data.allRoles.url = 'api/role';
    data.allRoles.fetch();

    data.allTenants.on('sync', onDataFetched);
    data.allTenants.url = 'api/tenant';
    data.allTenants.fetch();

    // Function to add user management menu item
    var addUserManagementMenuItem = function() {
      data.userManagementBypassEnabled = Origin.constants.userManagementBypassEnabled || false;
      Origin.globalMenu.addItem({
        "location": "global",
        "text": Origin.l10n.t('app.usermanagement'),
        "icon": "fa-users",
        "sortOrder": 3,
        "callbackEvent": "userManagement:open"
      });
    };

    Origin.on('constants:loaded', addUserManagementMenuItem);

    // If constants are already loaded, check immediately
    if (Origin.constants) {
      data.userManagementBypassEnabled = Origin.constants.userManagementBypassEnabled || false;
      addUserManagementMenuItem();
    }
  	}else {
      isReady = true;
    }
  });

  Origin.on('globalMenu:userManagement:open', function() {
    Origin.router.navigateTo('userManagement');
  });

  Origin.on('router:userManagement', function(location, subLocation, action) {
    if(isReady) {
      return onRoute(location, subLocation, action);
    }
    Origin.once('userManagement:dataReady', function() {
      onRoute(location, subLocation, action);
    });
  });

  var onRoute = function(location, subLocation, action) {
    // First check: verify user has base userManagement permissions
    // If not, block access to ALL userManagement routes
    if (!Origin.permissions.hasPermissions(data.featurePermissions)) {
      Origin.Notify.alert({
        type: 'error',
        title: Origin.l10n.t('app.errorpagenoaccesstitle'),
        text: Origin.l10n.t('app.errorpagenoaccess'),
        confirmButtonText: Origin.l10n.t('app.ok'),
        callback: function() {
          Origin.router.navigateTo('dashboard');
        }
      });
      return;
    }
    
    // Check if accessing editUsers route
    var isEditUsersRoute = (location && location === 'editUsers');
    
    // If editUsers route, verify user has Super Admin role
    if (isEditUsersRoute) {
      if (!isSuperAdmin()) {
        // Show access denied notification with translations
        Origin.Notify.alert({
          type: 'error',
          title: Origin.l10n.t('app.errorpagenoaccesstitle'),
          text: Origin.l10n.t('app.errorpagenoaccess'),
          confirmButtonText: Origin.l10n.t('app.ok'),
          callback: function() {
            Origin.router.navigateTo('dashboard');
          }
        });
        return;
      }
    }
    
    // Handle editUsers with subLocation (e.g., editUsers/addUser)
    if (isEditUsersRoute && subLocation === 'addUser') {
      location = 'addUser';
      isEditUsersRoute = true;
    }

    if (location && location === 'addUser') {
      // Check if user can add users - only allowed in editUsers mode when bypass is enabled
      if (data.userManagementBypassEnabled && !isEditUsersRoute) {
        // Show access denied notification with translations
        Origin.Notify.alert({
          type: 'error',
          title: Origin.l10n.t('app.errorpagenoaccesstitle'),
          text: Origin.l10n.t('app.errorpagenoaccess'),
          confirmButtonText: Origin.l10n.t('app.ok'),
          callback: function() {
            Origin.router.navigateTo('dashboard');
          }
        });
        return;
      }
      
      var addUserData = _.extend({}, data, {
        isEditUsersMode: isEditUsersRoute
      });
      
      Origin.contentPane.setView(AddUserView, {
        model: new Backbone.Model({ globalData: addUserData })
      });
      Origin.sidebar.addView(new AddUserSidebarView().$el);

      return;
    }

    var userCollection = new UserCollection();
    
    // Clone data and add edit users mode flag
    var routeData = _.extend({}, data, {
      isEditUsersMode: isEditUsersRoute
    });
    
    var globalModel = new Backbone.Model({ globalData: routeData })

    userCollection.once('sync', function() {
      Origin.contentPane.setView(UserManagementView, {
        model: globalModel,
        collection: userCollection
      });

      Origin.sidebar.addView(new UserManagementSidebarView({
        model: globalModel,
        collection: userCollection
      }).$el);
    });

    userCollection.fetch();
  };

  var onDataFetched = function() {
    // ASSUMPTION we always have roles and tenants
    if(data.allRoles.length > 0 && data.allTenants.length > 0) {
      isReady = true;
      Origin.trigger('userManagement:dataReady');
    }
  };
});
