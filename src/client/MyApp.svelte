<script lang="ts">
	import { myClient } from "./myClient.js";

	const enableOptimistic = true;

	const postsQuery = $derived(await myClient.queries.getPosts());
	const storiesQuery = $derived(await myClient.queries.getStories());
	const storiesQuery2 = $derived(await myClient.queries.getStories());

	let titleField = $state("");
	let contentField = $state("");

	function removeItem<T>(array: T[], item: T) {
		const index = array.indexOf(item);
		if (index === -1) return;
		array.splice(index, 1);
	}
	
	async function addPost() {
		const post = {
			id: crypto.randomUUID(),
			creationTime: new Date(),
			title: titleField,
			content: contentField
		}

		// optimistic update
		if (enableOptimistic) postsQuery.push(post);

		await myClient.mutations.createPost(post)
		.catch(()=>{
			// rollback optimistic update
			removeItem(postsQuery, post);
			alert("Failed to create post.");
		})
		.then(() => {
			titleField = "";
			contentField = "";
		});
	}

	async function deletePost(id: string) {
		await myClient.mutations.deletePost({ id }).catch(() => {
			alert("Failed to delete post.");
		});
	}

	async function addStory() {
		const story = { 
			id: crypto.randomUUID(),
			imageUrl: `https://picsum.photos/seed/${crypto.randomUUID()}/64`
		};
		
		// optimistic update
		if (enableOptimistic) storiesQuery.push(story);

		await myClient.mutations.createStory(story)
		.catch(() => {
			// rollback optimistic update
			removeItem(storiesQuery, story);
			alert("Failed to create story.");
		});
	}

	async function deleteStory(id: string) {
		await myClient.mutations.deleteStory({ id }).catch(() => {
			alert("Failed to delete story.");
		});
	}
</script>
<div class="absolute p-4 inset-0 max-w-200 mx-auto overflow-auto">
	<div class="
		flex items-center gap-3 overflow-auto p-4
		bg-surfaceContainer text-onSurfaceContainer
		rounded-xl mb-6
	">
		<button 
			onclick={addStory} 
			class="w-16 h-16 rounded-full bg-green-700 text-white text-3xl leading-1 flex items-center justify-center shrink-0 cursor-pointer"
		>
			+
		</button>
		{#each storiesQuery.toReversed() as story (story.id)}
			<button 
				onclick={()=>deleteStory(story.id)}
				class="w-16 h-16 rounded-full overflow-hidden border border-divider shrink-0 cursor-pointer"
			>
				<img src={story.imageUrl} alt="story" class="w-full h-full object-cover" />
			</button>
		{/each}
	</div>

	<div class="flex flex-col gap-4">
		<div class="flex flex-col items-stretch gap-3 p-4 bg-surfaceContainer text-onSurfaceContainer rounded-xl">
			<input 
				type="text" 
				bind:value={titleField} 
				placeholder="Post Title"
				class="p-3 border border-divider rounded"
			/>
			<textarea 
				bind:value={contentField} 
				placeholder="What's on your mind?" 
				class="p-3 border border-divider rounded resize-none"
			></textarea>
			<button 
				onclick={addPost} 
				class="px-4 py-2 bg-green-700 text-white rounded cursor-pointer self-end"
			>
				Post
			</button>
		</div>

		{#each postsQuery.toReversed() as post (post.id)}
			<div class="p-4 bg-surfaceContainer text-onSurfaceContainer rounded-xl">
				<h2 class="text-xl font-bold">{post.title}</h2>
				<div class="opacity-60 text-sm">
					Created at: {post.creationTime.toLocaleString()}
				</div>
				<hr class="my-2 opacity-20">
				<p>{post.content}</p>

				
				<button 
					class="mt-2 px-4 py-2 bg-red-900 rounded cursor-pointer float-right"
					onclick={()=>deletePost(post.id)}
				>
					Delete Post
				</button>
			</div>
		{/each}
	</div>


	<div>
		<code class="mt-8 p-4 bg-surfaceContainer text-onSurfaceContainer rounded-xl w-full block overflow-auto">
			<pre>{JSON.stringify(storiesQuery2.toReversed(), null, 2)}</pre>
		</code>
	</div>
</div>