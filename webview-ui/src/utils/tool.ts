export const includeHotfix = (data: any, type: 'branch' | 'cherry-pick') => {
  let hasHotfix = false
  if (type === 'branch') {
    hasHotfix = data.target_branch.includes('hotfix/')
  } else {
    hasHotfix = data.target_branches.some((branch: any) => branch.includes('hotfix/'))
  }
  return hasHotfix
}