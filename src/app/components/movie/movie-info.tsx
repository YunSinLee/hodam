import { API_URL } from "@/app/(my)/my/page";

const getMovie = async (id: string) => {
  const response = await fetch(`https://${API_URL}/${id}`);
  const json = await response.json();
  return json;
};

export default async function MovieInfo({ id }: { id: string }) {
  const movie = await getMovie(id);

  return <div>{movie.title}</div>;
}
