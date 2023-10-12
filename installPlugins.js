const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const config = require('./conf/config.json');

let frontendPlugins = [];
let backendPlugins = [];

async function setupPlugins() {
  
  console.log(chalk.bgCyan('\n🔌 (Step 1/6) Checking plugins config'));
  checkConfig();
  
  console.log(chalk.bgCyan('\n🔌 (Step 2/6) Cleanup frontend'));
  await cleanUpFrontend();
  
  console.log(chalk.bgCyan('\n🔌 (Step 3/6) Cleanup backend'));
  await cleanUpBackend();
  
  console.log(chalk.bgCyan('\n🔌 (Step 4/6) Copy frontend plugins'));
  await copyFrontendPlugins();

  console.log(chalk.bgCyan('\n🔌 (Step 5/6) Copy backend plugins'));
  await copyBackendPlugins();

  console.log(chalk.bgCyan('\n🔌 (Step 6/6) Installing backend plugin dependencies'));
  await installBackendPlugins();

  console.log(chalk.bgCyan('\n🔌 Done '));
}

function checkConfig() {
  const pluginsConfig = config?.plugins;
  if (!pluginsConfig) {
    console.log(chalk.yellow('No plugins config found in config.json'));
    process.exit(1);
  }

  for (const [pluginName, configValues] of Object.entries(pluginsConfig)) {
    if (!configValues?.isEnabled) {
      console.log(`Plugin ${chalk.yellow(pluginName)} is not enabled. Skipping...`);
      continue;
    }
    
    console.log(`👀 Checking config for plugin: ${chalk.blue(pluginName)}`);

    // Add frontend plugins
    if (configValues.frontend) {
      frontendPlugins.push(configValues.frontend);
    }

    // Add backend plugins
    if (configValues.backend) {
      backendPlugins.push({ ...configValues.backend, name: pluginName });
    }
  }
}

async function cleanUpFrontend() {
  // remove all plugins from frontend/src/plugins
  const pluginsDir = path.join(__dirname, 'frontend', 'src', 'plugins');
  await fs.remove(pluginsDir);
  console.log(`🗑 Removed all frontend plugins from ${chalk.blue( pluginsDir)}`);
}

async function cleanUpBackend() {
  // restore backend plugins folder
  await fs.remove('plugins');
  const checkout = await exec(`git checkout ./plugins`);
  console.log(`♻ Checkout ./plugins from git`);
  console.log(checkout.stdout);
}

async function copyFrontendPlugins() {
  return Promise.all(
    frontendPlugins.map(async (config) => {
      const pluginDir = config.path;
      const pluginName = path.basename(pluginDir);
      const dest = path.join(
        __dirname,
        'frontend',
        'src',
        'plugins',
        pluginName
      );
      await fs.copy(pluginDir, dest);
      console.log(`Copied frontend ${chalk.blue(pluginName)} to ${chalk.blue(dest)}`);
    })
  );
}

async function copyBackendPlugins() {
  return Promise.all(
    backendPlugins.map(async (config) => {
      if (!config.path) {
        console.log(`💢 No path found for plugin ${chalk.red(config.name)}`);
        return;
      }
      if (!config.dest) {
        console.log(`💢 No dest found for plugin ${chalk.red(config.name)}`);
        return;
      }
      const pluginDir = config.path;
      const pluginName = path.basename(pluginDir);
      const dest = path.join(__dirname, 'plugins', config.dest, pluginName);
      await fs.ensureDir(dest);
      await fs.copy(pluginDir, dest);
      console.log(`Copied backend plugin ${chalk.blue(pluginName)} to ${chalk.blue(dest)}`);
    })
  );
}

async function installBackendPlugins() {
  return Promise.all(
    backendPlugins.map(async (config) => {
      const pluginDir = config.path;
      const pluginName = path.basename(pluginDir);
      const dest = path.join(__dirname, 'plugins', config.dest, pluginName);
      const install = await exec(`npm install`, { cwd: dest });
      console.log(install.stdout);
    })
  );
}

setupPlugins();
