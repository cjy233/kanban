import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const router = express.Router();

// Claude Code 配置文件路径
const CONFIG_PATHS = {
  // 全局配置：~/.claude/settings.json
  globalSettings: path.join(os.homedir(), '.claude', 'settings.json'),
  // 项目配置：当前目录下的 .claude.json
  projectConfig: path.join(process.cwd(), '.claude.json')
};

/**
 * 安全读取 JSON 文件
 * @param {string} filePath - 文件路径
 * @returns {Promise<object>} - 解析后的对象，文件不存在或解析失败返回空对象
 */
async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    // 文件不存在或解析失败，返回空对象
    return {};
  }
}

/**
 * 深度合并两个对象
 * @param {object} target - 目标对象
 * @param {object} source - 源对象（优先级更高）
 * @returns {object} - 合并后的对象
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * GET /api/claude-config
 * 获取合并后的 Claude Code 配置
 * 优先级：settings.json < .claude.json（项目配置覆盖全局配置）
 */
router.get('/', async (req, res) => {
  try {
    // 读取全局配置和项目配置
    const [globalSettings, projectConfig] = await Promise.all([
      readJsonFile(CONFIG_PATHS.globalSettings),
      readJsonFile(CONFIG_PATHS.projectConfig)
    ]);

    // 合并配置：项目配置优先级更高
    const mergedConfig = deepMerge(globalSettings, projectConfig);

    // 确保返回的配置包含 env 和 mcpServers 字段
    const response = {
      ...mergedConfig,
      env: mergedConfig.env || {},
      mcpServers: mergedConfig.mcpServers || {}
    };

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
