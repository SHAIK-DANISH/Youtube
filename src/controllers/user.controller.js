import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/apiError.js';
import {User} from '../models/user.models.js';
import {uploadOnCloudinary} from '../utils/cloudinary.js';
import {ApiResponse} from '../utils/ApiResponse.js';



const registerUser = asyncHandler(async (req, res)=> {
    // res.status(200).json({
    //     message: "success register user"
    // })

    //get user details from frontend
    //validation - not empty, email format, password length
    // check it user already exists: using username or email
    // check for images, and for avatar
    // upload them to cloudinary
    //create user object- create entry in DB
    // remove password and refresh token from the response
    // check for user creation 
    // return response


    const {fullName, email, username, password}=req.body
    console.log(fullName, email, username, password);

    // if (fullName==='') {
    //     throw new ApiError(400, 'Full name cannot be empty')
    // }
    if ([fullName, email, username, password].some((field) =>{
        return field?.trim()==='';
    } )) {
        throw new ApiError(400, 'All fields are required')
    }
    const existedUser = await User.findOne({
        $or : [{email}, {username}]
    })
    if (existedUser) {
        throw new ApiError(409, 'User already exists')
    }
    const avatarLocalPath= req.files?.avatar[0]?.path;
    // const coverImagesLocalPaths= req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
    
    if (!avatarLocalPath) {
        throw new ApiError(400, 'Avatar is required')
    }

    //upload to cloudinary
    const avatarCloudinary = await uploadOnCloudinary(avatarLocalPath);
    const coverImagesCloudinary = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatarCloudinary) {
        throw new ApiError(500, 'Error uploading avatar')
    }
    // if(!coverImagesCloudinary) {
    //     throw new ApiError(500, 'Error uploading cover images')
    // }

    const user = await User.create({
        fullName,
        email,
        username: username.toLowerCase(),
        password,
        avatar: avatarCloudinary.url,
        coverImage: coverImagesCloudinary?.url ||  ""
    })
    const createdUser = await User.findById(user._id).select("-password -refreshToken")
    if (!createdUser) {
        throw new ApiError(500, 'Error creating user')
    }

    res.status(201).json(
        new ApiResponse(201,createdUser, 'User created successfully' )
    )


})


export {registerUser};