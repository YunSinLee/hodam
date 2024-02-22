import { API_URL } from "@/app/(my)/my/page";

const getVideos = async (id: string) => {
  const response = await fetch(`https://${API_URL}/${id}/videos`);
  const json = await response.json();
  return json;
};

export default async function MovieVideos({ id }: { id: string }) {
  const videos = await getVideos(id);

  return (
    <div>
      {videos.map((video: any) => (
        <iframe
          key={video.id}
          src={`https://www.youtube.com/embed/${video.key}`}
          title={video.name}
        />
      ))}
    </div>
  );
}
