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

// 允许访问的目录白名单
const ALLOWED_BASES = [
  os.homedir(),    // 用户主目录（~/.claude/ 等）
  process.cwd()    // 当前工作目录（项目目录）
];

/**
 * 验证 CLAUDE.md 文件路径
 * @param {string} filePath - 文件路径
 * @returns {object} - { valid: boolean, error?: string, resolvedPath?: string }
 */
function validateClaudeMdPath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, error: '路径不能为空' };
  }

  // 防止路径遍历攻击：检查是否包含 ..
  if (filePath.includes('..')) {
    return { valid: false, error: '路径不能包含 ..' };
  }

  // 解析路径（支持 ~ 展开）
  let resolvedPath = filePath;
  if (resolvedPath.startsWith('~')) {
    resolvedPath = path.join(os.homedir(), resolvedPath.slice(1));
  }
  resolvedPath = path.resolve(resolvedPath);

  // 只允许 .md 文件
  if (!resolvedPath.toLowerCase().endsWith('.md')) {
    return { valid: false, error: '只允许读写 .md 文件' };
  }

  // 验证路径在允许的目录范围内
  const isAllowed = ALLOWED_BASES.some(base => resolvedPath.startsWith(base + path.sep) || resolvedPath === base);
  if (!isAllowed) {
    return { valid: false, error: '路径不在允许的目录范围内' };
  }

  return { valid: true, resolvedPath };
}

/**
 * 创建文本文件备份
 * @param {string} filePath - 要备份的文件路径
 * @returns {Promise<string|null>} - 备份文件路径，文件不存在返回 null
 */
async function backupTextFile(filePath) {
  try {
    await fs.access(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.${timestamp}.bak`;
    await fs.copyFile(filePath, backupPath);
    return backupPath;
  } catch {
    // 文件不存在，无需备份
    return null;
  }
}

/**
 * GET /api/claude-config/claudemd
 * 读取 CLAUDE.md 文件内容
 * Query: path - 文件路径（支持 ~ 展开）
 */
router.get('/claudemd', async (req, res) => {
  try {
    const { path: filePath } = req.query;

    // 验证路径
    const validation = validateClaudeMdPath(filePath);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // 读取文件
    try {
      const content = await fs.readFile(validation.resolvedPath, 'utf-8');
      res.json({
        path: validation.resolvedPath,
        content,
        exists: true
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        // 文件不存在，返回空内容
        res.json({
          path: validation.resolvedPath,
          content: '',
          exists: false
        });
      } else {
        throw err;
      }
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/claude-config/claudemd
 * 保存 CLAUDE.md 文件内容
 * Body: { path: string, content: string }
 */
router.put('/claudemd', async (req, res) => {
  try {
    const { path: filePath, content } = req.body;

    // 验证路径
    const validation = validateClaudeMdPath(filePath);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // 验证内容
    if (typeof content !== 'string') {
      return res.status(400).json({ error: '内容必须是字符串' });
    }

    // 备份原文件
    const backupPath = await backupTextFile(validation.resolvedPath);

    // 确保目录存在
    const dir = path.dirname(validation.resolvedPath);
    await fs.mkdir(dir, { recursive: true });

    // 写入文件
    await fs.writeFile(validation.resolvedPath, content, 'utf-8');

    res.json({
      message: 'CLAUDE.md 已保存',
      path: validation.resolvedPath,
      _backup: backupPath
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 配置备份与恢复 ====================

// 备份目录：~/.claude/backups/
const BACKUP_DIR = path.join(os.homedir(), '.claude', 'backups');

/**
 * 确保备份目录存在
 */
async function ensureBackupDir() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

/**
 * 生成备份 ID（时间戳格式）
 * @returns {string} - 格式：YYYYMMDD-HHmmss-SSS
 */
function generateBackupId() {
  const now = new Date();
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${pad(now.getMilliseconds(), 3)}`;
}

/**
 * 备份配置文件到指定目录
 * @param {string} backupPath - 备份目录路径
 * @returns {Promise<Array>} - 备份的文件列表 [{name, size}]
 */
async function backupConfigFiles(backupPath) {
  const files = [];

  // 备份 settings.json
  try {
    const content = await fs.readFile(CONFIG_PATHS.globalSettings, 'utf-8');
    await fs.writeFile(path.join(backupPath, 'settings.json'), content, 'utf-8');
    files.push({ name: 'settings.json', size: content.length });
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    // 文件不存在，跳过
  }

  // 备份 .claude.json
  try {
    const content = await fs.readFile(CONFIG_PATHS.projectConfig, 'utf-8');
    await fs.writeFile(path.join(backupPath, '.claude.json'), content, 'utf-8');
    files.push({ name: '.claude.json', size: content.length });
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    // 文件不存在，跳过
  }

  return files;
}

/**
 * POST /api/claude-config/backup
 * 创建配置备份
 * 备份 settings.json 和 .claude.json 到 ~/.claude/backups/{id}/
 */
router.post('/backup', async (req, res) => {
  try {
    await ensureBackupDir();

    const backupId = generateBackupId();
    const backupPath = path.join(BACKUP_DIR, backupId);
    await fs.mkdir(backupPath, { recursive: true });

    // 使用共享函数备份配置文件
    const files = await backupConfigFiles(backupPath);

    // 如果没有任何文件可备份
    if (files.length === 0) {
      // 删除空备份目录
      await fs.rmdir(backupPath);
      return res.status(400).json({ error: '没有配置文件可备份' });
    }

    // 写入元数据
    const metadata = {
      id: backupId,
      createdAt: new Date().toISOString(),
      files
    };
    await fs.writeFile(path.join(backupPath, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');

    res.status(201).json({
      message: '备份创建成功',
      backup: metadata
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/claude-config/backups
 * 列出所有配置备份
 * 返回按时间倒序排列的备份列表
 */
router.get('/backups', async (req, res) => {
  try {
    await ensureBackupDir();

    // 读取备份目录
    let entries;
    try {
      entries = await fs.readdir(BACKUP_DIR, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.json({ backups: [] });
      }
      throw err;
    }

    // 过滤出目录并读取元数据
    const backups = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const metadataPath = path.join(BACKUP_DIR, entry.name, 'metadata.json');
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);
        backups.push(metadata);
      } catch {
        // 元数据不存在或解析失败，跳过
      }
    }

    // 按创建时间倒序排列
    backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ backups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/claude-config/restore/:id
 * 恢复指定备份
 * 恢复前会自动创建当前配置的备份
 */
router.post('/restore/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 验证备份 ID 格式（防止路径遍历）
    if (!/^\d{8}-\d{6}-\d{3}$/.test(id)) {
      return res.status(400).json({ error: '无效的备份 ID 格式' });
    }

    const backupPath = path.join(BACKUP_DIR, id);

    // 检查备份是否存在
    try {
      await fs.access(backupPath);
    } catch {
      return res.status(404).json({ error: `备份 "${id}" 不存在` });
    }

    // 验证备份元数据完整性
    try {
      await fs.access(path.join(backupPath, 'metadata.json'));
    } catch {
      return res.status(500).json({ error: '备份元数据损坏' });
    }

    // 恢复前先备份当前配置（自动备份）
    const preRestoreBackupId = generateBackupId();
    const preRestoreBackupPath = path.join(BACKUP_DIR, preRestoreBackupId);
    await fs.mkdir(preRestoreBackupPath, { recursive: true });

    // 使用共享函数备份当前配置
    const preRestoreFiles = await backupConfigFiles(preRestoreBackupPath);

    // 写入自动备份元数据
    if (preRestoreFiles.length > 0) {
      const preRestoreMetadata = {
        id: preRestoreBackupId,
        createdAt: new Date().toISOString(),
        files: preRestoreFiles,
        autoBackup: true,
        reason: `恢复备份 ${id} 前自动创建`
      };
      await fs.writeFile(
        path.join(preRestoreBackupPath, 'metadata.json'),
        JSON.stringify(preRestoreMetadata, null, 2),
        'utf-8'
      );
    } else {
      // 没有文件需要备份，删除空目录
      await fs.rmdir(preRestoreBackupPath);
    }

    // 恢复配置文件
    const restoredFiles = [];

    // 恢复 settings.json
    try {
      const content = await fs.readFile(path.join(backupPath, 'settings.json'), 'utf-8');
      // 确保目录存在
      await fs.mkdir(path.dirname(CONFIG_PATHS.globalSettings), { recursive: true });
      await fs.writeFile(CONFIG_PATHS.globalSettings, content, 'utf-8');
      restoredFiles.push('settings.json');
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      // 备份中没有此文件，跳过
    }

    // 恢复 .claude.json
    try {
      const content = await fs.readFile(path.join(backupPath, '.claude.json'), 'utf-8');
      await fs.writeFile(CONFIG_PATHS.projectConfig, content, 'utf-8');
      restoredFiles.push('.claude.json');
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      // 备份中没有此文件，跳过
    }

    res.json({
      message: `备份 "${id}" 恢复成功`,
      restoredFiles,
      preRestoreBackup: preRestoreFiles.length > 0 ? preRestoreBackupId : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
