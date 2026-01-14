import { Transformer } from "../src/lib/open-utilities/Transformer.js";

class MyClass {
	constructor(public name: string, public date: Date) {}
}

Transformer.defaultTransferable.registerPlugin({
	id: 'MyClass',
	isInstance(value: unknown) {
		return value instanceof MyClass;
	},
	transform(value) {
		return { ...value };
	},
	unTransform(value) {
		return new MyClass(value.name, value.date);
	}
});

const data = {
	date: new Date("2024-01-01T00:00:00Z"),
	map: new Map([["key", "value"]]),
	set: new Set([1, 2, 3]),
	undefined: undefined,
	custom: new MyClass("example", new Date("2022-06-15T12:00:00Z")),
	nested: {
		array: [
			new Date("2023-12-31T23:59:59Z"),
			new Map([["nestedKey", new Date("2021-05-20T08:30:00Z")]]),
		]
	}
};


{
	console.log("====== Transformer Test ======");
	const transformed = Transformer.defaultTransferable.transform(data);
	console.log("Transformed:", transformed);

	console.log("\n");

	const untransformed = Transformer.defaultTransferable.unTransform(transformed);
	console.log("Untransformed:", untransformed);
}


console.log("\n\n");

{
	console.log("====== Transformer JSON Test ======");
	const transformed = JSON.stringify(Transformer.defaultJson.transform(data), null, 2);
	console.log("Transformed JSON:", transformed);

	console.log("\n");

	const untransformed = Transformer.defaultJson.unTransform(JSON.parse(transformed));
	console.log("Untransformed JSON:", untransformed);
}