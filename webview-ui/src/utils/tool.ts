export const validateMr = (data: any, type: 'branch' | 'cherry-pick') => {
  let hasHotfix = false
  if (type === 'branch') {
    hasHotfix = data.target_branch.includes('hotfix/')
  } else {
    hasHotfix = data.target_branches.some((branch: any) => branch.includes('hotfix/'))
  }
  const titleHasV8 = data.title.includes('v8-') || data.title.includes('V8-')
  if (hasHotfix && !titleHasV8) {
    return false
  }
  return true
}



/**
 * 生成指定长度的字母+数字随机字符串
 * @param {number} length - 字符串长度
 * @returns {string} 随机字符串
 */
export function generateRandomAlphaNumStr(length = 10) {
  // 字符池：大小写字母 + 数字
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charsLength = chars.length;
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * charsLength));
  }
  return result;
}