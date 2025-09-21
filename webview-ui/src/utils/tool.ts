export const validateMr = (data: any, type: 'branch' | 'cherry-pick') => {
  let hasHotfix = false
  if (type === 'branch') {
    hasHotfix = data.target_branch.includes('hotfix/')
  } else {
    hasHotfix = data.target_branches.some((branch: any) => branch.includes('hotfix/'))
  }
  const titleHasV8 = data.title.includes('v8-') || data.title.includes('V8-')
  if (hasHotfix && !titleHasV8 ) {
    return false
  }
  return true
}