git reset HEAD~1
rm ./backport.sh
git cherry-pick a0378ba2305389a018a0f1e3de45fe7d1aa2e8ff
echo 'Resolve conflicts and force push this branch'
