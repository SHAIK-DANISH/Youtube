import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js';
import {User} from '../models/user.model.js';
import {uploadOnCloudinary} from '../utils/cloudinary.js';
import {ApiResponse} from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';

const generateAccessAndRefreshToken = async (userId) =>{
    try {
        console.log(userId);
        const user = await User.findById(userId); 
       
      
        const accessToken = await user.generateAccessToken();
      
        const refreshToken = user.generateRefreshToken();
        
        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});
        return {accessToken, refreshToken}


    } catch (error) {
        throw new ApiError(500, 'Error generating access and refersh tokens')
    }
}

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


const loginUser = asyncHandler(async (req, res)=> {
    // requset body data
    // username and email
    // find the user 
    // check password 
    // access and refresh token
    //send secure cookie
    // return response

    const {email, username, password}= req.body;
    
    if(username === "" || email === "") {
        throw new ApiError(400, 'All fields are required');
    }

    const user = await User.findOne({
        $or: [{username},{email}]
    }) 

    if (!user ) {
        throw new ApiError(404, "user not found");
    }
    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid ) {
        throw new ApiError(404, "Invalid user Credentials");
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id);  

    const LoggedInUser = await User.findById(user._id).select("-password -refreshToken");


    const options = {
        httpOnly: true,
        secure: true
    }
    return  res
            .status(200)
            .cookie('accessToken', accessToken, options)
            .cookie('refreshToken', refreshToken, options)
            .json( new ApiResponse(200,
                {
                    user: LoggedInUser, accessToken, refreshToken
                },
                "User logged in successfully"
            ))
});
const logoutUser = asyncHandler(async (req, res)=> {
    //
    await User.findByIdAndUpdate(req.user._id,
         {
            $set :{
                refershToken : undefined
            }
         },
         {
            new : true,
         }
        )
        const options = {
            httpOnly: true,
            secure: true
        }
        return res.status(200)
                .clearCookie('accessToken', options)
                .clearCookie('refreshToken', options)
                .json(new ApiResponse(200, {}, "User logged out successfully"))
});

const refreshAccessToken = asyncHandler(async (req, res)=> {
       
    const incomingRefreshToken= req.cookies.refreshToken || req.body.refreshToken;
    if (!incomingRefreshToken) {
        throw new ApiError(401, 'Unauthorized request,Refresh token is required')
    }

   try {
     const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
     const user= await User.findById(decodedToken._id)
     if (!user) {
         throw new ApiError(401, 'Invalid Refresh token')
     }
     if(user?.refreshToken !== incomingRefreshToken) {
         throw new ApiError(401, 'Refresh token is expired or Used')
     }
 
     const options = {
         httpOnly: true,
         secure: true
     }
     const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id)
 
     return res
             .status(200)
             .cookie('accessToken', accessToken, options)
             .cookie('refreshToken', newRefreshToken, options)
             .json( new ApiResponse(200,
                 {
                     accessToken, refreshToken: newRefreshToken
                 },
                 "Access token refreshed successfully"
             ))
   } catch (error) {
       throw new ApiError(401,error?.message || 'Invalid Refresh token')
    
   }  

});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const {oldPassword, newPassword}= req.body;
    // if (newPassword !== confirmPassword) {
    //     throw new ApiError(400, 'Passwords do not match')
    // }
    const user = User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) {
        throw new ApiError(400, 'Invalid old password')
    }

    user.password=newPassword;
    await user.save({validateBeforeSave: false});
    return res.status(200)
    .json(new ApiResponse(200, {}, 'Password changed successfully'))    

})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(200, req.user, "Current user fetched successfully")
})

const upadteAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email} = req.body;
    if (!fullName || !email) 
    {
        throw new ApiError(400, 'All fields are required')
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                email
            }
        },
        {
            new : true,
        }
    ).select('-password -refreshToken')
    return res.status(200)
            .json(new ApiResponse(200, user, 'User Account details  updated successfully'))

})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path
    if (!avatarLocalPath) {
        throw new ApiError(400, 'Avatar file is missing, so it  is required')
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar.url) {
        throw new ApiError(500, 'Error while uploading avatar')
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar : avatar.url,
                
            }
        },
        {
            new : true,
        }
    ).select('-password -refreshToken')

    return res.status(200)
            .json(new ApiResponse(200, user, 'User AvatarImage updated successfully'))
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path
    if (!coverImageLocalPath) {
        throw new ApiError(400, 'coverImageLocalPath file is missing, so it  is required')
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!coverImage.url) {
        throw new ApiError(500, 'Error while uploading coverImageLocalPath')
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage : coverImage.url,
                
            }
        },
        {
            new : true,
        }
    ).select('-password -refreshToken')

    return res.status(200)
            .json(new ApiResponse(200, user, 'User coverImage updated successfully'))
})



export {registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    getCurrentUser,
    changeCurrentPassword,
    upadteAccountDetails,
    updateUserAvatar,
    updateUserCoverImage

}