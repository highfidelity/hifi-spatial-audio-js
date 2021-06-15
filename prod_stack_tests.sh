#!/bin/bash

set -e

stacks="api.highfidelity.com \
	api-pro.highfidelity.com \
	api-pro-east.highfidelity.com \
	api-pro-eu.highfidelity.com"

for stack in $stacks; do 
	echo $stack
	npm run test health -- --stackname=$stack --useStderr 2>&1 > testoutput
	#./testfails.sh
	fails=$(grep FAIL testoutput | wc -l)

	if [[ $fails == "0" ]]; then
    		echo "$stack success"
	else
    		echo "$stack fail"
	fi
done
