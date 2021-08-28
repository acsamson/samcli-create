const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const glob = require('glob');
const exec = require('execa');
const rimraf = require('rimraf');
const BasicGenerator = require('../../BasicGenerator');
const filterPkg = require('./filterPkg');
const prettier = require('prettier');
const sylvanas = require('sylvanas');
const sortPackage = require('sort-package-json');
const { getFastGithub } = require('umi-utils');

function log(...args) {
  console.log(`${chalk.gray('>')}`, ...args);
}

function globList(patternList, options) {
  let fileList = [];
  patternList.forEach(pattern => {
    fileList = [...fileList, ...glob.sync(pattern, options)];
  });

  return fileList;
}

const getGithubUrl = async () => {
  const fastGithub = await getFastGithub();
  if (fastGithub === 'gitee.com' || fastGithub === 'github.com.cnpmjs.org') {
    return 'https://github.com/acsamson/samcli-pro';
  }
  return 'https://github.com/acsamson/samcli-pro';
};

class AntDesignProGenerator extends BasicGenerator {
  prompting() {
    if (this.opts.args.language) {
      this.prompts = {
        language: this.opts.args.language,
      };
    } else {
        const prompts = [
          // 第1步选择语言
        {
          name: 'language',
          type: 'list',
          message: '🍧 请选择要使用的语言?（推荐使用TS',
          choices: ['TypeScript', 'JavaScript'],
          default: 'TypeScript',
            },
          // 第2步选择模板类型
        {
          name: 'allBlocks',
          type: 'list',
          message: '💁‍♂️ 想使用哪种脚手架?',
          choices: ['魔改版'],
          default: '魔改版',
        },
      ];
      return this.prompt(prompts).then(props => {
        this.prompts = props;
      });
    }
  }

  async writing() {
    const { language = 'TypeScript', allBlocks, } = this.prompts;

      const isTypeScript = language === 'TypeScript';
      // 选择输入的名称作为包名和文件夹名
    const projectName = this.opts.name || this.opts.env.cwd;
    const projectPath = path.resolve(projectName);

    const envOptions = {
      cwd: projectPath,
    };

    const githubUrl = await getGithubUrl();
    const gitArgs = [`clone`, githubUrl, `--depth=1`];

    if (allBlocks === '魔改版') {
      log(`🙃 准备下载魔改版ant design pro v5...`);
    //   gitArgs.push('--branch', 'all-blocks');
    }

    gitArgs.push(projectName);

    if (
      fs.existsSync(projectPath) &&
      fs.statSync(projectPath).isDirectory() &&
      fs.readdirSync(projectPath).length > 0
    ) {
      console.log('\n');
      console.log(`🤖 请在空文件夹中使用`);
      process.exit(1);
    }

    // 克隆远程地址
    await exec(
      `git`,
      gitArgs,
      process.env.TEST
        ? {}
        : {
            stdout: process.stdout,
            stderr: process.stderr,
            stdin: process.stdin,
          },
    );

    log(`👌 克隆成功`);

    const packageJsonPath = path.resolve(projectPath, 'package.json');
    const pkg = require(packageJsonPath);
    // 如果当前是ts版本, 则删除所有ts相关文件
    if (!isTypeScript) {
      log('🎏 [sylvanas] 当前是JS环境...');
      const tsFiles = globList(['**/*.tsx', '**/*.ts'], {
        ...envOptions,
        ignore: ['**/*.d.ts'],
      });
      // sylvanas将ts文件转为js
      sylvanas(tsFiles, {
        ...envOptions,
        action: 'overwrite',
      });

      log('🎏 清除TS中...');
      const removeTsFiles = globList(['tsconfig.json', '**/*.d.ts'], envOptions);
      removeTsFiles.forEach(filePath => {
        const targetPath = path.resolve(projectPath, filePath);
        fs.removeSync(targetPath);
      });
    }

    // 拷贝README文件
    const babelConfig = path.resolve(__dirname, 'README.md');
    fs.copySync(babelConfig, path.resolve(projectPath, 'README.md'));

    // 重新生成一个package.json
    if (pkg['samcli-create']) {
      const { ignoreScript = [], ignoreDependencies = [] } = pkg['samcli-create'];
      // filter scripts and devDependencies
      const projectPkg = {
        ...pkg,
        scripts: filterPkg(pkg.scripts, ignoreScript),
        devDependencies: filterPkg(pkg.devDependencies, ignoreDependencies),
      };
      // remove samcli-create config
      delete projectPkg['samcli-create'];
      fs.writeFileSync(
        path.resolve(projectPath, 'package.json'),
        // 删除一个包之后 json会多了一些空行。sortPackage 可以删除掉并且排序
        // prettier 会容忍一个空行
        prettier.format(JSON.stringify(sortPackage(projectPkg)), {
          parser: 'json',
        }),
      );
    }

    // 删掉一些没有用的文件
    if (pkg['samcli-create'] && pkg['samcli-create'].ignore) {
      log('清理中...');
      const ignoreFiles = pkg['samcli-create'].ignore;
      const fileList = globList(ignoreFiles, envOptions);

      fileList.forEach(filePath => {
        const targetPath = path.resolve(projectPath, filePath);
        fs.removeSync(targetPath);
      });
    }
  }
}

module.exports = AntDesignProGenerator;
