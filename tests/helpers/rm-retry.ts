import fs from 'node:fs'

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Windows 上 SQLite/libsql 连接关闭后文件句柄释放存在延迟，立即删除临时目录
 * 可能短暂抛出 EBUSY/EPERM。这里做指数退避重试；重试耗尽后放弃清理
 *（临时目录由操作系统负责回收），避免误报测试失败。
 */
export async function rmWithRetry(target: string, retries = 5): Promise<void> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      fs.rmSync(target, { recursive: true, force: true })
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (attempt === retries || (code !== 'EBUSY' && code !== 'EPERM')) {
        return
      }
      await delay(50 * 2 ** attempt)
    }
  }
}
