When worker finishes editing code, script runs auditor.sh to test if code works. Output of that test is saved. If test fails, script takes the last 10 lines of the test output and saves it in variable $LAST_ERROR (around line 72).

Then worker tries to fix it again (Attempt 2). If test fails again, script takes the NEW test output and overwrites $LAST_ERROR.

If it fails 3 times, loop stops. At this moment, $LAST_ERROR holds the exact error message from Attempt 3.

Script writes this Attempt 3 error into last_failure.log. So "last error" just means the error from the final test attempt before script gave up.


----

tambem que pedir para ver se os paths mostrados nos markdowns estão alinhados com os scripts
