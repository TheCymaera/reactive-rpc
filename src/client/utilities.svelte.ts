

export function asyncState<T>(promise: ()=>Promise<T>, initialValue: T) {
	let result: T = $state(initialValue);
	let error: Error | undefined = $state(undefined);
	let loading = $state(true);

	const reload = async () => {
		loading = true;
		error = undefined;
		try {
			result = await promise();
		} catch (e) {
			error = e as Error;
		}
		loading = false;
	};

	if ($effect.tracking()) {
		$effect(()=>{
			reload();
		});
	} else {
		$effect.root(()=>{
			$effect(()=>{
				reload();
			});
		});
	}

	return {
		get result() {
			return result;
		},
		set result(v: T) {
			result = v;
		},
		get error() {
			return error;
		},
		get loading() {
			return loading;
		},
	};
}
