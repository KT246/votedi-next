import MyRoomsPage from "../../pages/MyRoomsPage";
import ProtectedUserRoute from "../../components/ProtectedUserRoute";

export default function MyRoomsRoute() {
  return (
    <ProtectedUserRoute>
      <MyRoomsPage />
    </ProtectedUserRoute>
  );
}
