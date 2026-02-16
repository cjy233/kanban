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

/**
 * 创建文件备份
 * @param {string} filePath - 要备份的文件路径
 * @returns {Promise<string|null>} - 备份文件路径，文件不存在则返回 null
 */
async function createBackup(filePath) {
  try {
    // 检查文件是否存在
    await fs.access(filePath);
    // 生成备份文件名：原文件名.bak
    const backupPath = `${filePath}.bak`;
    await fs.copyFile(filePath, backupPath);
    return backupPath;
  } catch (err) {
    // 文件不存在，无需备份
    return null;
  }
}

/**
 * 安全写入 JSON 文件（写入前自动备份）
 * @param {string} filePath - 文件路径
 * @param {object} data - 要写入的数据
 * @returns {Promise<string|null>} - 备份文件路径
 */
async function writeJsonFile(filePath, data) {
  // 写入前创建备份
  const backupPath = await createBackup(filePath);
  // 确保目录存在
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  // 写入文件，格式化为 2 空格缩进
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return backupPath;
}

/**
 * PUT /api/claude-config/env
 * 更新环境变量配置
 * 接收 JSON body { env: {...} }，更新 ~/.claude/settings.json 的 env 字段
 * 写入前自动备份原文件
 */
router.put('/env', async (req, res) => {
  try {
    const { env } = req.body;

    // 验证请求体
    if (env === undefined) {
      return res.status(400).json({ error: '请求体必须包含 env 字段' });
    }

    if (typeof env !== 'object' || Array.isArray(env) || env === null) {
      return res.status(400).json({ error: 'env 必须是一个对象' });
    }

    // 读取当前全局配置
    const globalSettings = await readJsonFile(CONFIG_PATHS.globalSettings);

    // 更新 env 字段
    globalSettings.env = env;

    // 写回文件（自动备份）
    const backupPath = await writeJsonFile(CONFIG_PATHS.globalSettings, globalSettings);

    // 读取项目配置并合并，返回完整配置
    const projectConfig = await readJsonFile(CONFIG_PATHS.projectConfig);
    const mergedConfig = deepMerge(globalSettings, projectConfig);

    const response = {
      ...mergedConfig,
      env: mergedConfig.env || {},
      mcpServers: mergedConfig.mcpServers || {},
      _backup: backupPath // 返回备份文件路径（如果有）
    };

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/claude-config/mcp
 * 获取 MCP 服务器列表
 * 返回合并后的 mcpServers 对象（项目配置覆盖全局配置）
 */
router.get('/mcp', async (req, res) => {
  try {
    const [globalSettings, projectConfig] = await Promise.all([
      readJsonFile(CONFIG_PATHS.globalSettings),
      readJsonFile(CONFIG_PATHS.projectConfig)
    ]);

    // 合并 mcpServers：项目配置优先
    const globalMcp = globalSettings.mcpServers || {};
    const projectMcp = projectConfig.mcpServers || {};
    const mergedMcp = { ...globalMcp, ...projectMcp };

    // 转换为数组格式，便于前端展示
    // source 字段标识配置来源：global 可编辑，project 只读
    const servers = Object.entries(mergedMcp).map(([name, config]) => ({
      name,
      ...config,
      source: projectMcp[name] ? 'project' : 'global'
    }));

    res.json({ servers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/claude-config/mcp
 * 添加 MCP 服务器
 * 接收 JSON body { name, command, args?, env? }
 * 写入 ~/.claude/settings.json 的 mcpServers 字段
 */
router.post('/mcp', async (req, res) => {
  try {
    const { name, command, args, env } = req.body;

    // 验证必填字段
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name 是必填字段且必须是字符串' });
    }
    if (!command || typeof command !== 'string') {
      return res.status(400).json({ error: 'command 是必填字段且必须是字符串' });
    }

    // 读取当前全局配置
    const globalSettings = await readJsonFile(CONFIG_PATHS.globalSettings);
    const mcpServers = globalSettings.mcpServers || {};

    // 检查名称唯一性
    if (mcpServers[name]) {
      return res.status(409).json({ error: `MCP 服务器 "${name}" 已存在` });
    }

    // 构建服务器配置
    const serverConfig = { command };
    if (args !== undefined) {
      if (!Array.isArray(args)) {
        return res.status(400).json({ error: 'args 必须是数组' });
      }
      serverConfig.args = args;
    }
    if (env !== undefined) {
      if (typeof env !== 'object' || Array.isArray(env) || env === null) {
        return res.status(400).json({ error: 'env 必须是对象' });
      }
      serverConfig.env = env;
    }

    // 添加服务器
    mcpServers[name] = serverConfig;
    globalSettings.mcpServers = mcpServers;

    // 写回文件
    const backupPath = await writeJsonFile(CONFIG_PATHS.globalSettings, globalSettings);

    res.status(201).json({
      message: `MCP 服务器 "${name}" 创建成功`,
      server: { name, ...serverConfig },
      _backup: backupPath
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/claude-config/mcp/:name
 * 更新 MCP 服务器
 * 接收 JSON body { command?, args?, env?, newName? }
 */
router.put('/mcp/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { command, args, env, newName } = req.body;

    // 读取当前全局配置
    const globalSettings = await readJsonFile(CONFIG_PATHS.globalSettings);
    const mcpServers = globalSettings.mcpServers || {};

    // 检查服务器是否存在
    if (!mcpServers[name]) {
      return res.status(404).json({ error: `MCP 服务器 "${name}" 不存在` });
    }

    // 如果要重命名，检查新名称是否已存在
    if (newName && newName !== name && mcpServers[newName]) {
      return res.status(409).json({ error: `MCP 服务器 "${newName}" 已存在` });
    }

    // 获取当前配置
    const serverConfig = { ...mcpServers[name] };

    // 更新字段
    if (command !== undefined) {
      if (typeof command !== 'string') {
        return res.status(400).json({ error: 'command 必须是字符串' });
      }
      serverConfig.command = command;
    }
    if (args !== undefined) {
      if (!Array.isArray(args)) {
        return res.status(400).json({ error: 'args 必须是数组' });
      }
      serverConfig.args = args;
    }
    if (env !== undefined) {
      if (typeof env !== 'object' || Array.isArray(env) || env === null) {
        return res.status(400).json({ error: 'env 必须是对象' });
      }
      serverConfig.env = env;
    }

    // 处理重命名
    if (newName && newName !== name) {
      delete mcpServers[name];
      mcpServers[newName] = serverConfig;
    } else {
      mcpServers[name] = serverConfig;
    }

    globalSettings.mcpServers = mcpServers;

    // 写回文件
    const backupPath = await writeJsonFile(CONFIG_PATHS.globalSettings, globalSettings);

    const finalName = newName || name;
    res.json({
      message: `MCP 服务器 "${finalName}" 更新成功`,
      server: { name: finalName, ...serverConfig },
      _backup: backupPath
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/claude-config/mcp/:name
 * 删除 MCP 服务器
 */
router.delete('/mcp/:name', async (req, res) => {
  try {
    const { name } = req.params;

    // 读取当前全局配置
    const globalSettings = await readJsonFile(CONFIG_PATHS.globalSettings);
    const mcpServers = globalSettings.mcpServers || {};

    // 检查服务器是否存在
    if (!mcpServers[name]) {
      return res.status(404).json({ error: `MCP 服务器 "${name}" 不存在` });
    }

    // 删除服务器
    delete mcpServers[name];
    globalSettings.mcpServers = mcpServers;

    // 写回文件
    const backupPath = await writeJsonFile(CONFIG_PATHS.globalSettings, globalSettings);

    res.json({
      message: `MCP 服务器 "${name}" 已删除`,
      _backup: backupPath
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
