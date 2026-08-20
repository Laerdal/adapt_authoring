// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
module.exports = function(grunt) {
  require('matchdep').filterAll('grunt-*').forEach(grunt.loadNpmTasks);
  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    'generate-lang-json': {
      options: {
        langFileExt: '.json',
        src: {
          backend: 'routes/lang',
          frontend: 'frontend/src/**/lang'
        },
        dest: 'temp/lang'
      }
    },
    copy: {
      main: {
        files: [
          {
            expand: true,
            flatten: true,
            src: [
              'frontend/src/core/**/assets/**',
              'frontend/src/modules/**/assets/**',
              'frontend/src/plugins/**/assets/**',
              'frontend/src/libraries/**/assets/**'
            ],
            dest: 'frontend/build/css/assets/',
            filter: 'isFile'
          },
          {
            expand: true,
            flatten: true,
            src: ['frontend/src/libraries/ace/*'],
            dest: 'frontend/build/js/ace'
          }
        ]
      }
    },
    less: {
      dev: {
        options: {
          baseUrl: 'frontend/src',
          src: [
            'frontend/src/core/**/*.less',
            'frontend/src/modules/**/*.less',
            'frontend/src/plugins/**/*.less',
            'frontend/src/libraries/**/*.less'
          ],
          paths: 'frontend/src/core/less',
          generateSourceMaps: true,
          compress: false,
          dest: 'frontend/build/css',
          cssFilename: 'adapt.css',
          mapFilename: 'adapt.css.map'
        }
      },
      compile: {
        options: {
          baseUrl: 'frontend/src',
          src: [
            'frontend/src/core/**/*.less',
            'frontend/src/less/**/*.less',
            'frontend/src/modules/**/*.less',
            'frontend/src/plugins/**/*.less',
            'frontend/src/libraries/**/*.less'
          ],
          paths: 'frontend/src/core/less',
          generateSourceMaps: false,
          compress: true,
          dest: 'frontend/build/css',
          cssFilename: 'adapt.css',
          mapFilename: 'adapt.css.map'
        }
      }
    },
    handlebars: {
      compile: {
        options: {
          amd: true,
          namespace:"Handlebars.templates",
          processName: function(filePath) {
            var newFilePath = filePath.split("/");
            newFilePath = newFilePath[newFilePath.length - 1].replace(/\.[^/.]+$/, "");
            return  newFilePath;
          },
          partialRegex: /^part_/,
          partialsPathRegex: /\/partials\//
        },
        files: [
          {
            follow: true,
            src: [
              'frontend/src/core/**/*.hbs',
              'frontend/src/modules/**/*.hbs',
              'frontend/src/plugins/**/*.hbs'
            ],
            dest: 'frontend/src/templates/templates.js'
          }
        ]
      }
    },
    requirejs: {
      dev: {
        options: {
          baseUrl: 'frontend/src',
          name: 'core/app',
          mainConfigFile: "frontend/src/core/config.js",
          out: "frontend/build/js/origin.js",
          preserveLicenseComments: true,
          optimize: "none"
        }
      },
      compile: {
        options: {
          baseUrl: 'frontend/src',
          name: 'core/app',
          mainConfigFile: "frontend/src/core/config.js",
          out: "frontend/build/js/origin.js",
          optimize: "none"
        }
      }
    },
    babel: {
      dev: {
        options: {
          compact: false,
          retainLines: true,
          presets: [ [ '@babel/preset-env', { targets: { ie: '11' } } ] ],
          sourceType: 'script'
        },
        src: 'frontend/build/js/origin.js',
        dest: 'frontend/build/js/origin.js'
      },
      compile: {
        options: {
          comments: false,
          minified: true,
          presets: [ [ '@babel/preset-env', { targets: { ie: '11' } } ] ],
          sourceType: 'script'
        },
        src: 'frontend/build/js/origin.js',
        dest: 'frontend/build/js/origin.js'
      }
    },
    mochaTest: {
      src: ['test/*.js'],
      options: {
        reporter: 'spec',
        timeout: 3500
      }
    },
    requireBundle: {
      modules: {
        src: 'frontend/src/modules/*',
        dest: 'frontend/src/modules/modules.js'
      },
      plugins: {
        src: 'frontend/src/plugins/*',
        dest: 'frontend/src/plugins/plugins.js'
      }
    }
  });

  grunt.registerTask('migration-conf', 'Creating migration Conf', function() {
    var mongoUri = require('mongodb-uri');
    var config = grunt.file.readJSON('conf/config.json');
    var connectionString = '';

    if (config.dbConnectionUri) {
      connectionString = config.dbConnectionUri;

      var dbConnectionUriParsed = mongoUri.parse(connectionString);
      dbConnectionUriParsed.database = config.dbName;
      connectionString = mongoUri.format(dbConnectionUriParsed);

    } else {
      // Construct the authentication part of the connection string.
      var authenticationString = config.dbUser && config.dbPass ? config.dbUser + ':' + config.dbPass + '@' : '';

      // Check if a MongoDB replicaset array has been specified.
      if (config.dbReplicaset && Array.isArray(config.dbReplicaset) && config.dbReplicaset.length !== 0) {
        // The replicaset should contain an array of hosts and ports
        connectionString = 'mongodb://' + authenticationString + config.dbReplicaset.join(',') + '/' + config.dbName
      } else {
        // Get the host and port number from the configuration.

        var portString = config.dbPort ? ':' + config.dbPort : '';

        connectionString = 'mongodb://' + authenticationString + config.dbHost + portString + '/' + config.dbName;
      }
      if (typeof config.dbAuthSource === 'string' && config.dbAuthSource !== '' ) {
        connectionString += '?authSource=' + config.dbAuthSource
      }
    }
    var migrateConf = {
      migrationsDir : 'migrations/lib',
      es6 : false,
      dbConnectionUri: connectionString
    };
    grunt.file.write('conf/migrate.json', JSON.stringify(migrateConf, null, 2));
  });

  // Compiles frontend plugins
  grunt.registerMultiTask('requireBundle', 'Generates a .js file with a bunch of imports for the path files', function() {
    var modulePaths = '';
    // Go through each subfolder in the plugins directory
    var foldersArray = grunt.file.expand({ filter: "isDirectory" }, this.data.src);
    // Check if any plugins are available
    if (foldersArray.length === 0) {
      modulePaths += "'";
    }
    foldersArray.forEach(function(path, index, folders) {
      // Strip off front of path to make relative path to config file
      var relativePath = path.replace(grunt.config.get('requirejs').dev.options.baseUrl, '').slice(1);
      var splitter = "','";
      if (index === folders.length - 1) splitter = "'";
      modulePaths += relativePath + '/index' + splitter;
    });
    grunt.file.write(this.data.dest, "define(['" + modulePaths +"], function() {});");
  });

  grunt.registerMultiTask('less', 'Compile Less files to CSS', function() {
    var path = require('path');
    var less = require('less');
    var options = this.options({});
    var shouldGenerateSourceMaps = options.generateSourceMaps;
    var destination = options.dest;
    var mapFilename = options.mapFilename;
    var imports = getImports();
    var lessOptions = getLessOptions();
    var sourceMapPath = path.join(destination, mapFilename);
    var importsPath = sourceMapPath + '.imports';
    var done = this.async();

    if (!shouldGenerateSourceMaps) removeSourceMaps();

    less.render(imports, lessOptions, complete);

    function getImports() {
      var src = options.src;
      var ret = '';

      for (var i = 0, l = src.length; i < l; i++) {
        grunt.file.expand({
          filter: options.filter,
          follow: true
        }, src[i]).forEach(function(lessPath) {
          ret += '@import \'' + path.normalize(lessPath) + '\';\n';
        });
      }
      return ret;
    }

    function getLessOptions() {
      var ret = {
        compress: options.compress,
        paths: options.paths
      };
      if (shouldGenerateSourceMaps) {
        ret.sourceMap = {
          'sourceMapFileInline': false,
          'outputSourceFiles': true,
          'sourceMapBasepath': 'src',
          'sourceMapURL': mapFilename
        };
      }
      return ret;
    }

    function removeSourceMaps() {
      if (grunt.file.exists(sourceMapPath)) {
        grunt.file.delete(sourceMapPath, { force: true });
      }
      if (grunt.file.exists(importsPath)) {
        grunt.file.delete(importsPath, { force: true });
      }
    }

    function complete(error, output) {
      if (error) return grunt.fail.fatal(JSON.stringify(error, false, ' '));

      var outputMap = output.map;

      if (outputMap) {
        grunt.file.write(sourceMapPath, outputMap);
        grunt.file.write(importsPath, imports);
      }
      grunt.file.write(path.join(destination, options.cssFilename), output.css);
      done();
    }
  });
  grunt.registerTask('generate-lang-json', function() {
    const fs = require('fs-extra');
    const path = require('path');

    const options = this.options();
    const backendGlob = path.join(options.src.backend, `*${options.langFileExt}`);
    const dest = options.dest;
    // load each route lang file
    /**
    * NOTE there must be a file in routes/lang for the language to be loaded,
    * won't work if you've only got lang files in frontend
    */
    grunt.file.expand({}, path.join(backendGlob)).forEach(backendPath => {
      const basename = path.basename(backendPath);
      const frontendGlob = path.join(options.src.frontend, basename);
      let data = { ...fs.readJSONSync(backendPath) };
      // load all matching frontend lang files
      grunt.file.expand({}, frontendGlob).forEach(frontendPath => {
        data = { ...data, ...fs.readJSONSync(frontendPath) };
      });
      fs.ensureDirSync(dest);
      fs.writeJSONSync(path.join(dest, basename), data, { spaces: 2 });
    });
  });

  // Bundles frontend by calling r.js directly. The grunt-contrib-requirejs
  // plugin silently drops the `include` option, which causes shimmed libs
  // declared inside function-scoped require() calls (jqueryUI, handlebars,
  // jqueryForm, etc.) to be excluded from the bundle. r.js itself honours
  // `include` correctly.
  // Usage: requirejs-direct:dev | requirejs-direct:compile
  grunt.registerTask('requirejs-direct', 'Bundle frontend via r.js directly (bypasses grunt-contrib-requirejs which drops `include`).', function(mode) {
    var done = this.async();
    var path = require('path');
    var fs = require('fs');
    var os = require('os');
    var spawn = require('child_process').spawn;

    var modeKey = mode || 'compile';
    var existing = grunt.config.get('requirejs.' + modeKey + '.options');
    if (!existing) {
      grunt.fail.fatal('No requirejs config found for mode: ' + modeKey);
      return;
    }

    var rjsConfig = Object.assign({}, existing, {
      baseUrl: path.resolve(existing.baseUrl),
      mainConfigFile: path.resolve(existing.mainConfigFile),
      out: path.resolve(existing.out),
      // Mirror the shimmed libs loaded by frontend/src/core/app.js#loadLibraries.
      // r.js's static analyser misses these because the require() call is inside
      // a function body, not at module top level.
      include: [
        'ace/ace', 'handlebars', 'imageReady', 'inview',
        'jqueryForm', 'jqueryTagsInput', 'jqueryUI',
        'polyfill', 'scrollTo', 'selectize', 'sweetalert', 'velocity'
      ]
    });

    var configFile = path.join(os.tmpdir(), 'adapt-rjs-' + process.pid + '-' + Date.now() + '.json');
    fs.writeFileSync(configFile, JSON.stringify(rjsConfig, null, 2));

    grunt.log.writeln('Bundling with r.js (mode=' + modeKey + ')');
    grunt.log.verbose.writeln('r.js config: ' + configFile);

    var rjsBin = path.resolve('node_modules/requirejs/bin/r.js');
    var child = spawn(process.execPath, [rjsBin, '-o', configFile], { stdio: 'inherit' });

    child.on('close', function(code) {
      try { fs.unlinkSync(configFile); } catch (e) { /* ignore */ }
      if (code !== 0) {
        grunt.fail.fatal('r.js exited with code ' + code);
        return;
      }
      done();
    });

    child.on('error', function(err) {
      grunt.fail.fatal('Failed to spawn r.js: ' + err.message);
    });
  });

  // Builds the New UI from source (new-ui-source/ via Vite) then deploys the
  // compiled output to public/new — same pattern as less/requirejs-direct for
  // the old frontend.
  //
  // Node version: the authoring tool runs on Node 18, but the New UI toolchain
  // (Tailwind v4 / oxide) requires Node 20+. To keep Node 18 as the machine
  // default, set NEW_UI_NODE_BIN to a Node 20 bin directory (e.g.
  // /root/.nvm/versions/node/v20.x/bin). It is prepended to PATH for the New UI
  // install/build child processes ONLY — grunt and everything else stay on the
  // default Node. If unset, the current Node is used (fine when already >= 20).
  //
  // If any step fails the task degrades: public/new keeps serving the last
  // deployed bundle (a warning is logged) — the overall grunt build never fails
  // because of the New UI.
  grunt.registerTask('sync-new-ui', 'Compile new-ui-source/ with Vite and deploy to public/new.', function() {
    var done = this.async();
    var path = require('path');
    var fs = require('fs');
    var spawn = require('child_process').spawn;

    var newUiDir   = path.join(__dirname, 'new-ui-source');
    var distDir    = path.join(newUiDir, 'dist');
    var syncScript = path.join(__dirname, 'scripts', 'sync-new-ui.js');
    var npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

    // Auto-detect the newest Node 20 installed under nvm, so a plain
    // `grunt build` works without any environment setup. An explicit
    // NEW_UI_NODE_BIN always wins over auto-detection.
    function discoverNode20Bin() {
      try {
        var base = process.env.NVM_DIR || path.join(require('os').homedir(), '.nvm');
        var versions = path.join(base, 'versions', 'node');
        var found = fs.readdirSync(versions)
          .filter(function(d) { return /^v20\./.test(d); })
          .sort(function(a, b) {
            var x = a.slice(1).split('.').map(Number), y = b.slice(1).split('.').map(Number);
            return (x[0] - y[0]) || (x[1] - y[1]) || (x[2] - y[2]);
          });
        if (!found.length) return undefined;
        var bin = path.join(versions, found[found.length - 1], 'bin');
        return fs.existsSync(path.join(bin, 'node')) ? bin : undefined;
      } catch (e) { return undefined; }
    }

    var node20Src = process.env.NEW_UI_NODE_BIN ? 'NEW_UI_NODE_BIN' : 'auto-detected';
    var node20Bin = process.env.NEW_UI_NODE_BIN || discoverNode20Bin(); // dir with Node 20 node/npm

    // Env for New UI child processes: Node 20 on PATH when resolved above.
    function childEnv() {
      var env = Object.assign({}, process.env);
      if (node20Bin) {
        var key = ('Path' in env && !('PATH' in env)) ? 'Path' : 'PATH';
        env[key] = node20Bin + path.delimiter + (env[key] || '');
      }
      return env;
    }

    // Degrade, don't fail: warn and leave public/new untouched.
    function degrade(reason) {
      grunt.log.warn('New UI not rebuilt (' + reason + '). /new will serve the '
        + 'previously deployed bundle in public/new (may be stale).');
      done();
    }

    // Run an npm step in new-ui-source; on non-zero/spawn-error, degrade.
    function npmStep(args, label, onOk) {
      var child = spawn(npm, args, { cwd: newUiDir, stdio: 'inherit', shell: true, env: childEnv() });
      child.on('error', function(err) { degrade(label + ' failed to spawn: ' + err.message); });
      child.on('exit', function(code) {
        if (code !== 0) return degrade(label + ' exited with code ' + code);
        onOk();
      });
    }

    // Tailwind oxide ships its native engine as a platform-specific package.
    // If node_modules was installed under a Node that skipped it (e.g. Node 18
    // vs oxide's node>=20 requirement), the parent exists but the binding does
    // not — detect that so we reinstall rather than build against a broken tree.
    function oxideBindingPresent() {
      try {
        var dir = path.join(newUiDir, 'node_modules', '@tailwindcss');
        var osPrefix = 'oxide-' + process.platform; // e.g. oxide-linux-*, oxide-win32-*, oxide-darwin-*
        // Require an oxide package for THIS OS that actually contains a .node binary.
        // A wrong-platform or partial dir (e.g. a win32 tree copied onto Linux) must not pass.
        return fs.readdirSync(dir).some(function(n) {
          if (n.indexOf(osPrefix) !== 0) return false;
          try { return fs.readdirSync(path.join(dir, n)).some(function(f) { return f.endsWith('.node'); }); }
          catch (e) { return false; }
        });
      } catch (e) { return false; }
    }

    function runSync() {
      var env = Object.assign({}, process.env, { NEW_UI_DIST_PATH: distDir });
      var syncChild = spawn(process.execPath, [syncScript], { stdio: 'inherit', env: env });
      syncChild.on('exit', function(syncCode) {
        if (syncCode !== 0) grunt.log.warn('sync-new-ui exited with code ' + syncCode + '; /new may serve a stale bundle.');
        done();
      });
      syncChild.on('error', function(err) { grunt.log.warn('sync-new-ui failed to spawn: ' + err.message); done(); });
    }

    function build() {
      grunt.log.writeln('Building New UI from source (' + newUiDir + ')...');
      grunt.log.writeln(node20Bin
        ? 'Using Node 20 (' + node20Src + '): ' + node20Bin
        : 'NEW_UI_NODE_BIN not set and no Node 20 found under nvm; using default Node '
          + '(Tailwind v4 requires Node 20 — build may fail).');
      npmStep(['run', 'build'], 'New UI Vite build', function() {
        grunt.log.ok('New UI build complete.');
        runSync();
      });
    }

    // Install when deps are missing OR the oxide native binding is absent
    // (self-heals a tree installed under the wrong Node). Otherwise skip for speed.
    if (!fs.existsSync(path.join(newUiDir, 'node_modules')) || !oxideBindingPresent()) {
      grunt.log.writeln('Installing new-ui-source dependencies ('
        + (node20Bin ? 'Node 20 via ' + node20Src : 'default Node') + ')...');
      npmStep(['install'], 'New UI dependency install', build);
    } else {
      build();
    }
  });

  grunt.registerTask('default', ['build:dev']);
  grunt.registerTask('test', ['mochaTest']);

  grunt.registerTask('validate-component-defaults', 'Ensure componentPropertyDefaults.json contains all schema default entries.', function() {
    var fs = require('fs');
    var path = require('path');

    var configPath = path.join('conf', 'config.json');
    var defaultsPath = path.join('conf', 'componentPropertyDefaults.json');

    if (!grunt.file.exists(configPath)) {
       grunt.log.warn('Missing ' + configPath + '; skipping validate-component-defaults.');
       return;
    }
    
    var config = grunt.file.readJSON(configPath);

    if (!grunt.file.exists(defaultsPath)) {
      grunt.fail.fatal('Missing conf/componentPropertyDefaults.json');
      return;
    }

    var frameworkRoot = path.join('temp', config.masterTenantID, 'adapt_framework', 'src');
    var componentsRoot = path.join(frameworkRoot, 'components');
    var coreSchemaPath = path.join(frameworkRoot, 'core', 'schema', 'component.model.schema');

    if (!grunt.file.exists(componentsRoot) || !grunt.file.exists(coreSchemaPath)) {
      grunt.fail.fatal('Could not find framework schema source under ' + frameworkRoot + '. Ensure framework plugins are installed/synced before build.');
      return;
    }

    var defaultsConfig = grunt.file.readJSON(defaultsPath);
    var missing = [];

    function isObject(value) {
      return value && typeof value === 'object' && !Array.isArray(value);
    }

    function collectDefaults(node, currentPath, out) {
      if (!isObject(node)) {
        return;
      }

      if (Object.prototype.hasOwnProperty.call(node, 'default')) {
        out.push(currentPath);
      }

      if (isObject(node.properties)) {
        Object.keys(node.properties).forEach(function(key) {
          var nextPath = currentPath ? currentPath + '.' + key : key;
          collectDefaults(node.properties[key], nextPath, out);
        });
      }

      if (isObject(node.items)) {
        var itemsPath = currentPath ? currentPath + '.items' : 'items';
        collectDefaults(node.items, itemsPath, out);
      }
    }

    function validateSection(sectionName, expectedPaths) {
      var section = defaultsConfig[sectionName];
      if (!section || !isObject(section)) {
        missing.push(sectionName + ' (missing section)');
        return;
      }

      expectedPaths.forEach(function(propertyPath) {
        if (!Object.prototype.hasOwnProperty.call(section, propertyPath)) {
          missing.push(sectionName + '.' + propertyPath);
        }
      });
    }

    var coreSchema = grunt.file.readJSON(coreSchemaPath);
    var sharedExpected = [];
    Object.keys(coreSchema.properties || {}).forEach(function(key) {
      collectDefaults(coreSchema.properties[key], key, sharedExpected);
    });
    validateSection('*', sharedExpected);

    fs.readdirSync(componentsRoot)
      .sort()
      .forEach(function(componentFolder) {
        var folderPath = path.join(componentsRoot, componentFolder);
        var stat = fs.statSync(folderPath);
        if (!stat.isDirectory()) {
          return;
        }

        var bowerPath = path.join(folderPath, 'bower.json');
        var schemaPath = path.join(folderPath, 'properties.schema');
        if (!grunt.file.exists(bowerPath) || !grunt.file.exists(schemaPath)) {
          return;
        }

        var bowerJson = grunt.file.readJSON(bowerPath);
        if (!bowerJson.component) {
          return;
        }

        var schemaJson = grunt.file.readJSON(schemaPath);
        var expected = [];
        Object.keys(schemaJson.properties || {}).forEach(function(key) {
          collectDefaults(schemaJson.properties[key], 'properties.' + key, expected);
        });

        validateSection(bowerJson.component, expected);
      });

    if (missing.length) {
      var preview = missing.slice(0, 50).map(function(entry) { return ' - ' + entry; }).join('\n');
      var suffix = missing.length > 50
        ? ('\n - ... and ' + (missing.length - 50) + ' more')
        : '';
      grunt.log.warn(
        'componentPropertyDefaults.json is missing required default mappings.\n' +
        'Add the following keys:\n' + preview + suffix +
        '\n\nTip: regenerate component defaults before build.'
      );
      return;
    }

    grunt.log.ok('componentPropertyDefaults.json validation passed.');
  });

  /**
  * Accepts 'build' and 'prod' params
  * e.g. grunt build:prod
  */
  grunt.registerTask('build', 'Running build', function(mode) {
    grunt.log.subhead(`Building application in ${mode === 'prod' ? 'production' : 'dev'} mode`);

    var isProduction = mode === 'prod' ? true : false;
    var compilation = isProduction ? 'compile' : 'dev';

    try {
      // add flag to config
      var configFile = 'conf/config.json';
      var config = grunt.file.readJSON(configFile);
      config.isProduction = isProduction;
      grunt.file.write(configFile, JSON.stringify(config, null, 2));
      // run the task
      grunt.task.run(['migration-conf', 'validate-component-defaults', 'requireBundle', 'generate-lang-json', 'copy', 'less:' + compilation, 'handlebars', 'requirejs-direct:'+ compilation, `babel:${compilation}`, 'sync-new-ui']);
    } catch(e) {
      grunt.task.run(['validate-component-defaults', 'requireBundle', 'copy', 'less:' + compilation, 'handlebars', 'requirejs-direct:' + compilation, `babel:${compilation}`, 'sync-new-ui']);
    }
  });
};
