git reset HEAD~1
rm ./backport.sh
git cherry-pick 5cbbfeb4a842fd853e16e64bc686cc839efd95b8
echo 'Resolve conflicts and force push this branch'
