import { createThread } from "../../services/actions/openai";

export default async function Hodam() {
  const { id: threadId } = await createThread();

  return (
    <div>
      <h1>{threadId}</h1>
    </div>
  );
}
