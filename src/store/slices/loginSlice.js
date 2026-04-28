import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as authService from "../../services/authService";

export const loginAsync = createAsyncThunk("login/loginAsync", async ({ email, password }, thunkAPI) => {
  try {
    const { data, activeOrg } = await authService.loginWithPassword(email, password);
    return { ...data, activeOrg };
  } catch (error) {
    const errorCode = error?.response?.data?.errorCode;
    const message = error?.response?.data?.message || "Login failed";
    return thunkAPI.rejectWithValue({ errorCode, message });
  }
});

const loginSlice = createSlice({
  name: "login",
  initialState: {
    isLoggedIn: false,
    user: null,
    activeOrg: null,
    loading: false,
    error: null,
    errorCode: null,
  },
  reducers: {
    clearError(state) {
      state.error = null;
      state.errorCode = null;
    },
    loginSuccess(state, action) {
      state.isLoggedIn = true;
      state.user = action.payload;
      state.error = null;
      state.errorCode = null;
    },
    logout(state) {
      state.isLoggedIn = false;
      state.user = null;
      state.activeOrg = null;
      state.error = null;
      state.errorCode = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.errorCode = null;
      })
      .addCase(loginAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.isLoggedIn = true;
        state.user = action.payload;
        state.activeOrg = action.payload.activeOrg ?? null;
      })
      .addCase(loginAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? "Login failed";
        state.errorCode = action.payload?.errorCode ?? null;
      });
  },
});

export const { clearError, loginSuccess, logout } = loginSlice.actions;

export default loginSlice.reducer;
