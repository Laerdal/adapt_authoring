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
    allTenants: new Backbone.Collection()
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
      if (!Origin.constants.userManagementBypassEnabled) {
        Origin.globalMenu.addItem({
          "location": "global",
          "text": Origin.l10n.t('app.usermanagement'),
          "icon": "fa-users",
          "sortOrder": 3,
          "callbackEvent": "userManagement:open"
        });
      }
    };

    Origin.on('constants:loaded', addUserManagementMenuItem);

    // If constants are already loaded, check immediately
    if (Origin.constants) {
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
    if (location && location === 'addUser') {
      Origin.contentPane.setView(AddUserView, {
        model: new Backbone.Model({ globalData: data })
      });
      Origin.sidebar.addView(new AddUserSidebarView().$el);

      return;
    }

    var userCollection = new UserCollection();
    var globalModel = new Backbone.Model({ globalData: data })

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
