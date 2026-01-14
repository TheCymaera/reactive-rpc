import { DependencyTracker } from "../lib/iceberg/procedureServer.js";

export interface Post {
	id: string;
	creationTime: Date;
	title: string;
	content: string;
}

export interface Story {
	id: string;
	imageUrl: string;
}

export const myDatabase = DependencyTracker.track({
	posts: [] as Post[],
	stories: [] as Story[],
});


// seed data
myDatabase.posts.push(
	{
		id: crypto.randomUUID(),
		creationTime: new Date(Date.now() - 1000000),
		title: "Hello World!",
		content: "This is my first post.",
	},
	{
		id: crypto.randomUUID(),
		creationTime: new Date(Date.now() - 500000),
		title: "Another post",
		content: "This is my second post.",
	}
);

for (let i = 1; i <= 10; i++) {
	myDatabase.stories.push({
		id: crypto.randomUUID(),
		imageUrl: `https://picsum.photos/seed/${i}/64`,
	});
}