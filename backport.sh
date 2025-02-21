git reset HEAD~1
rm ./backport.sh
git cherry-pick 7ad55f50997f09640884e5475ecc9c0d217ec034
echo 'Resolve conflicts and force push this branch'
