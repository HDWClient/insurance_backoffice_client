import { configureStore } from "@reduxjs/toolkit";
import loginReducer from "./slices/loginSlice";
import userReducer  from "./slices/userSlice";
import roleReducer  from "./slices/roleSlice";
import orgReducer   from "./slices/orgSlice";
import meReducer    from "./slices/meSlice";

const store = configureStore({
  reducer: {
    login: loginReducer,
    users: userReducer,
    roles: roleReducer,
    orgs:  orgReducer,
    me:    meReducer,
  },
});

export default store;
