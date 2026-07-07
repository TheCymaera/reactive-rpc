import z from "zod";
import { myDatabase } from "./myDatabase.js";
import { mutation, query } from "@iceberg/core/procedure-server";

export const getPosts = query(z.void(), async () => {
	return myDatabase.posts;
});

export const createPost = mutation(z.object({ title: z.string(), content: z.string() }), async (input) => {
	const newPost = {
		id: crypto.randomUUID() as string,
		creationTime: new Date(),
		title: input.title,
		content: input.content,
	};
	myDatabase.posts.push(newPost);

	return "Post created successfully";
});

export const deletePost = mutation(z.object({ id: z.string() }), async (input) => {
	const index = myDatabase.posts.findIndex(post => post.id === input.id);
	if (index === -1) {
		throw new Error("Post not found");
	}
	myDatabase.posts.splice(index, 1);

	return "Post deleted successfully";
});

export const getStories = query(z.void(), async () => {
	return myDatabase.stories;
});

export const createStory = mutation(z.object({ imageUrl: z.string() }), async (input) => {
	const newStory = {
		id: crypto.randomUUID() as string,
		imageUrl: input.imageUrl,
	};
	myDatabase.stories.push(newStory);

	return "Story created successfully";
});

export const deleteStory = mutation(z.object({ id: z.string() }), async (input) => {
	const index = myDatabase.stories.findIndex(story => story.id === input.id);
	if (index === -1) {
		throw new Error("Story not found");
	}
	myDatabase.stories.splice(index, 1);

	return "Story deleted successfully";
});